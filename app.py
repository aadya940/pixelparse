# app.py

from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import Pix2StructProcessor, Pix2StructForConditionalGeneration
import requests
from PIL import Image
import io
import os
import base64
import torch
from torchao.quantization.quant_api import quantize_, Int8WeightOnlyConfig
import multiprocessing

torch.set_num_threads(multiprocessing.cpu_count())

app = Flask(__name__)
CORS(app)


print("Loading Pix2Struct model...")
processor = Pix2StructProcessor.from_pretrained("google/deplot")
model = Pix2StructForConditionalGeneration.from_pretrained("google/deplot")

# JIT Compile model for faster inference
model = torch.compile(model)

for name, module in model.named_modules():
    if isinstance(module, torch.nn.Linear):  # Only quantize Linear layers
        quantize_(module, Int8WeightOnlyConfig())

# Ensure model is on CPU
model.to(torch.device("cpu"))

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

    data = request.json
    print("Received data:", data)

    if not data or "imageUrl" not in data:
        return jsonify({"success": False, "error": "No image URL provided"}), 400

    try:
        print(f"Received request to extract data from: {data['imageUrl'][:50]}...")

        # Check if it's a base64 image
        if data["imageUrl"].startswith("data:image"):
            # Extract the base64 data
            image_data = data["imageUrl"].split(",")[1]
            image = Image.open(io.BytesIO(base64.b64decode(image_data)))
        elif data["imageUrl"].startswith("images/"):
            image_path = data["imageUrl"]
            if not os.path.exists(image_path):
                return (
                    jsonify({"success": False, "error": "Local image not found"}),
                    404,
                )
            image = Image.open(image_path)
        else:
            response = requests.get(data["imageUrl"], stream=True)
            if not response.ok:
                error_msg = (
                    f"Failed to download image. Status code: {response.status_code}"
                )
                print(f"Image download error: {error_msg}")
                return jsonify({"success": False, "error": error_msg}), 400
            image = Image.open(io.BytesIO(response.content))

        inputs = processor(
            images=image,
            text="Generate underlying data table of the figure below:",
            return_tensors="pt",
        )
        predictions = model.generate(**inputs, 
            max_new_tokens=3000,   # Limits token count
        )

        table_text = processor.decode(predictions[0], skip_special_tokens=True)
        print(f"Model output: {table_text[:100]}...")
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


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "message": "API is running"}), 200


if __name__ == "__main__":
    print("Starting Flask server...")
    app.run(debug=True, host="0.0.0.0", port=5000)
