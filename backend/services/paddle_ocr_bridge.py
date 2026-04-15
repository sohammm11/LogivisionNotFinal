import os
import sys
import json
import base64
import logging
import easyocr

# Suppress logging
logging.getLogger('easyocr').setLevel(logging.ERROR)

def process_ocr(image_base64):
    try:
        # Create temp image file
        img_data = base64.b64decode(image_base64)
        img_path = 'temp_ocr_image.jpg'
        with open(img_path, 'wb') as f:
            f.write(img_data)

        # Initialize EasyOCR
        # Suppress the download progress bar and other logs
        print("Initializing EasyOCR engine...", file=sys.stderr)
        
        # reader = easyocr.Reader(['en'], gpu=False) 
        # To suppress progress bar, we might need to monkeypatch or just ignore it if it goes to stderr.
        # However, some libraries print to stdout. Let's redirect stdout temporarily.
        
        reader = easyocr.Reader(['en'], gpu=False, verbose=False)
        
        # result structure: [([[x, y], ...], text, confidence), ...]
        result = reader.readtext(img_path)
        
        # Cleanup
        if os.path.exists(img_path):
            os.remove(img_path)

        if not result:
            return {"success": False, "error": "No text detected"}

        # Extract all text detections
        detections = []
        for line in result:
            box, text, conf = line
            detections.append({
                "text": str(text),
                "confidence": float(conf)
            })

        return {
            "success": True, 
            "detections": detections, 
            "full_text": " ".join([d["text"] for d in detections])
        }

    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    try:
        # Read image data from stdin
        image_data = sys.stdin.read().strip()
        
        if not image_data:
            print(json.dumps({"success": False, "error": "No image data provided through stdin"}))
            sys.exit(1)

        # Handle data URI prefix if present
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]

        result = process_ocr(image_data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Bridge error: {str(e)}"}))
        sys.exit(1)
