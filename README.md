# PixelParse: Chart Data Extraction Tool

PixelParse is a Chrome extension that automatically extracts summary data from 
chart images or your screenshots and converts them into structured CSV datasets. It leverages
google's deplot model to implement this functionality. 


## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Install python dependencies present in the `requirements.txt`.
4. Start the flask server in the backend. (`python app.py`)
5. Enable "Developer mode" in the top-right corner
6. Click "Load unpacked" and select the `plot2dataset` directory
7. The extension icon should now appear in your browser toolbar


## Usage

### Method 1: Context Menu (Right-Click)
1. Find any chart image on a webpage
2. Right-click on the image
3. Select "Extract Chart Data" from the context menu
4. The extension will process the image and automatically download a CSV file with the extracted data

### Method 2: Screenshot Capture
1. Click on the PixelParse extension icon in your toolbar
2. Click the "Capture Screenshot" button
3. A new tab will open with your screenshot
4. Use the cropping tool to select the chart area
5. Click "Extract Data"
6. The extension will process the selected area and download a CSV file with the extracted data

## Strengths

- **Lightweight**

- **Versatile Chart Recognition**: Works well with common chart types:
  - Line charts
  - Bar charts
  - Scatter plots
  - Time series data

- **Flexible Input Methods**: 
  - Right-click on any chart image
  - Capture and crop screenshots for charts that can't be directly right-clicked

- **Intelligent Data Parsing**:
  - Automatically detects time-value pairs
  - Handles tabular data with multiple columns
  - Recognizes monthly data formats

- **Clean Output Format**:
  - Generates well-structured CSV files
  - Preserves data relationships from the original chart

## Limitations

- **Chart Type Restrictions**: Struggles with complex or specialized chart types:
  - Color Sensitive Charts
  - Pie charts
  - Radar/spider charts
  - Sankey diagrams
  - Treemaps
  - Heat maps
  - 3D charts

- **Not Message Queued**

- **Color Sensitivity**:
  - Limited ability to distinguish between data series based on color
  - Charts that rely heavily on color coding may not be parsed correctly

## Technical Details

PixelParse uses Google's DePlot model to convert chart images into structured data. 
The extension handles the user interface and image capture, while the Python backend 
processes the images using the AI model.


```
@misc{liu2022deplot,
      title={DePlot: One-shot visual language reasoning by plot-to-table translation},
      author={Liu, Fangyu and Eisenschlos, Julian Martin and Piccinno, Francesco and Krichene, Syrine and Pang, Chenxi and Lee, Kenton and Joshi, Mandar and Chen, Wenhu and Collier, Nigel and Altun, Yasemin},
      year={2022},
      eprint={2212.10505},
      archivePrefix={arXiv},
      primaryClass={cs.CL}
}
```
