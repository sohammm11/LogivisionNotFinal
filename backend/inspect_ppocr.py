import inspect
from paddleocr import PaddleOCR
import json

try:
    sig = inspect.signature(PaddleOCR.__init__)
    params = list(sig.parameters.keys())
    print(json.dumps({"success": True, "params": params}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
