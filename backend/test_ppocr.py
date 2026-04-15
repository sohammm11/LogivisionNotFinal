import traceback
import sys
import os

try:
    print("Importing PaddleOCR...")
    from paddleocr import PaddleOCR
    print("Import successful.")
    
    print("Attempting initialization with lang='en'...")
    try:
        ocr = PaddleOCR(lang='en')
        print("Initialization with lang='en' successful.")
    except Exception as e:
        print(f"Initialization with lang='en' failed: {str(e)}")
        traceback.print_exc()

    print("\nAttempting initialization with use_gpu=False, use_mkldnn=False...")
    try:
        ocr = PaddleOCR(lang='en', use_gpu=False, use_mkldnn=False)
        print("Initialization with use_gpu/use_mkldnn successful.")
    except Exception as e:
        print(f"Initialization with use_gpu/use_mkldnn failed: {str(e)}")
        traceback.print_exc()

except Exception as e:
    print(f"Outer error: {str(e)}")
    traceback.print_exc()
