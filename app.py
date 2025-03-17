# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoProcessor, AutoModelForVision2Seq
import requests
from PIL import Image
import io
import os
import base64
import torch
from torch.quantization import quantize_dynamic

app = Flask(__name__)
CORS(app)

print("Loading DePlot model...")
processor = AutoProcessor.from_pretrained("google/deplot")
model = AutoModelForVision2Seq.from_pretrained("google/deplot")

# Move model to CPU and ensure it's in eval mode
model = model.to(torch.device("cpu"))
model.eval()

# Quantize the model
model = quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8)
model = torch.compile(model)
print("Model loaded successfully")

def parse_table_text(text):
    lines = text.strip().split("\n")
    rows = [line for line in lines if line.strip()]

    if not rows:
        return []

    headers = rows[0].split("\t")

    data = []
    for i, row in enumerate(rows):
        if i == 0 and len(headers) > 1:
            continue

        cells = row.split("\t")
        if len(headers) > 1:
            row_data = {}
            for j, header in enumerate(headers):
                if j < len(cells):
                    row_data[header] = cells[j]
                else:
                    row_data[header] = ""
            data.append(row_data)
        else:
            data.append(cells)

    return data


@app.route("/extract-data", methods=["POST", "OPTIONS"])
def extract_data():
    if request.method == "OPTIONS":
        return "", 200

    try:
        data = request.json
        print("Received data:", data)

        if not data or "imageUrl" not in data:
            return jsonify({"success": False, "error": "No image URL provided"}), 400

        # Process image
        image = get_image_from_data(data)
        
        # Generate with explicit memory management
        with torch.inference_mode():
            inputs = processor(
                images=image,
                text="""Generate the underlying data table of the figure given below:""",
                return_tensors="pt",
            )
            
            predictions = model.generate(
                **inputs,
                max_new_tokens=2000,
                num_beams=3,
                temperature=0.7,
                top_p=0.8,
                do_sample=False,
                early_stopping=True
            )
            
            table_text = processor.decode(predictions[0], skip_special_tokens=True)
            print(f"Full model output: {table_text}")

        table_data = parse_table_text(table_text)
        print(f"Extracted {len(table_data)} data rows")
        print(f"table_data: {table_data}")

        return jsonify(
            {"success": True, "tableData": table_data, "rawText": table_text}
        )

    except Exception as e:
        import traceback
        traceback_str = traceback.format_exc()
        print(f"Error processing image: {str(e)}")
        print(traceback_str)
        return jsonify({"success": False, "error": str(e)}), 500

# Helper function to get image from data
def get_image_from_data(data):
    if data["imageUrl"].startswith("data:image"):
        image_data = data["imageUrl"].split(",")[1]
        return Image.open(io.BytesIO(base64.b64decode(image_data)))
    elif data["imageUrl"].startswith("images/"):
        if not os.path.exists(data["imageUrl"]):
            raise FileNotFoundError("Local image not found")
        return Image.open(data["imageUrl"])
    else:
        response = requests.get(data["imageUrl"], stream=True)
        if not response.ok:
            raise ValueError(f"Failed to download image. Status code: {response.status_code}")
        return Image.open(io.BytesIO(response.content))


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "message": "API is running"}), 200


if __name__ == "__main__":
    print("Starting Flask server...")
    app.run(debug=True, host="0.0.0.0", port=5000)
