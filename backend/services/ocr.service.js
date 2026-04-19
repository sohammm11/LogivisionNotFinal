const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─── Persistent Logging ───────────────────────────────────────────────────────
const logFile = path.join(__dirname, 'backend_ocr.log');
const log = (msg) => {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.log(`[OCR] ${msg}`);
};

// ─── Gemini Init ──────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ─── Image Parsing Helper ─────────────────────────────────────────────────────
const parseImageSource = (imageSource) => {
  if (typeof imageSource !== 'string') return { mimeType: 'image/jpeg', base64Data: '' };
  const match = imageSource.match(/^data:(image\/\w+);base64,(.+)$/);
  if (match) return { mimeType: match[1], base64Data: match[2] };
  return { mimeType: 'image/jpeg', base64Data: imageSource };
};

// ─── Super Hard Fix: Extract JSON from any text ───────────────────────────────
const extractJson = (text) => {
  // Try to find anything between { and }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    // Clean common AI garbage (markdown, backticks, leading/trailing text)
    let cleaned = match[0].replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    log(`[JSON_FIX] Failed to parse matched segment: ${e.message}`);
    return null;
  }
};

// ─── Main: processChallanImage (SUPER ROBUST VERSION) ─────────────────────────
const processChallanImage = async (imageSource) => {
  console.log('[DEBUG] Neural Multi-Language OCR initiated');
  const { mimeType, base64Data } = parseImageSource(imageSource);
  
  if (!base64Data) throw new Error('Invalid image data');

  log(`[Gemini-Neural] Processing. MIME: ${mimeType}, Size: ${base64Data.length}`);

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are an expert at reading logistics delivery challans, gate passes, and invoices. 
These documents can be professionally printed (digital) or handwritten, and may be in English, Hindi, Marathi, or mixed.

Your task is to extract the following 9 fields from the provided image. Use your understanding of logistics terminology and document layouts to find the values even if they have slightly different labels or are positioned unexpectedly.

Fields to extract:
1. challan_number: Look for "Challan No", "DC No", "Bill No", "पावती क्र", "बिल नं", etc.
2. date: Look for "Date", "Dt", "दिनांक", or a date string in DD-MM-YYYY or common formats.
3. from: The sender/consignor company name or location.
4. to: The receiver/consignee/destination "Bill To" or "Ship To" name or location.
5. goods_description: Summary of items listed (e.g. "Flare Kurti, Skirts", "Industrial Gear").
6. weight: Look for "Weight", "WT", "Qty" (if weight), "Tonnes", "KG", "टन", etc.
7. total_value: Look for "Total", "Grand Total", "Amount", "Value", "रुपये", or numbers near currency symbols.
8. capacity: Look for "Load", "Capacity", "Full/Half/Empty", "क्षमता".
9. truck_number: Indian vehicle registration (e.g. MH12AB1234, RJ14CP0092).

Rules:
- Return ONLY a raw JSON object with NO markdown, NO backticks, NO text.
- Use null for fields effectively missing.
- Translate Hindi/Marathi values to English for the final JSON.
- For truck_number, normalize to uppercase with no spaces.
- For weight and value, include the units/prefix if visible (e.g. "14 Tons", "Rs. 497").

JSON Format:
{
  "challan_number": null,
  "date": null,
  "from": null,
  "to": null,
  "goods_description": null,
  "weight": null,
  "total_value": null,
  "capacity": null,
  "truck_number": null
}`;

  try {
    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      { text: prompt }
    ]);

    const text = (await result.response).text();
    log(`[Gemini-Neural] RAW RESULT:\n${text}`);

    let parsed = extractJson(text);
    
    if (!parsed) {
        log(`[Gemini-Neural] JSON extraction failed.`);
        return { 
          challan_number: null, date: null, from: null, to: null, 
          goods_description: null, weight: null, total_value: null, 
          capacity: null, truck_number: null, scan_confidence: 'low' 
        };
    }

    // Confidence Scoring
    const fields = ['challan_number', 'date', 'from', 'to', 'goods_description', 'weight', 'total_value', 'capacity', 'truck_number'];
    const populatedCount = fields.filter(f => parsed[f] !== null && parsed[f] !== undefined && parsed[f] !== 'null' && parsed[f] !== '').length;
    
    let confidence = 'low';
    if (populatedCount >= 6) confidence = 'high';
    else if (populatedCount >= 4) confidence = 'medium';

    parsed.scan_confidence = confidence;

    // Fallback for truck_number
    if (!parsed.truck_number) {
       const truckMatch = text.match(/[A-Z]{2}\s?[0-9]{2}\s?[A-Z]{0,2}\s?[0-9]{4}/i);
       if (truckMatch) parsed.truck_number = truckMatch[0].toUpperCase().replace(/\s/g, '');
    }

    log(`[Gemini-Neural] FINAL OUTPUT (Confidence: ${confidence}): ${JSON.stringify(parsed)}`);
    return parsed;

  } catch (err) {
    log(`[Gemini-Neural] FATAL ERROR: ${err.message}`);
    return { 
      challan_number: null, date: null, from: null, to: null, 
      goods_description: null, weight: null, total_value: null, 
      capacity: null, truck_number: null, scan_confidence: 'low' 
    };
  }
};

// ─── Main: processPlateImage (SPECIALIZED NEURAL PROMPT) ──────────────────────
const processPlateImage = async (imageSource) => {
  log(`[Plate-OCR] Processing started`);
  const { mimeType, base64Data } = parseImageSource(imageSource);
  
  if (!base64Data) throw new Error('Invalid image data');

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    
    // Highly specific prompt for license plates
    const prompt = `You are a high-speed vehicle registration AI. 
    READ THE LICENSE PLATE IN THIS IMAGE.
    The plate is an Indian Vehicle Registration Plate (e.g., MH 12 AB 1234 or GJ05BZ1190).
    
    INSTRUCTIONS:
    1. EXTRACT the plate number with extreme precision.
    2. NORMALIZE the output by removing all spaces and dashes.
    3. Return ONLY a valid JSON object.
    
    Schema: {"vehicleNo": "PLATE_NUMBER_HERE"}`;

    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      { text: prompt }
    ]);

    const text = (await result.response).text();
    log(`[Plate-OCR] RAW Result: ${text}`);

    let parsed = extractJson(text);

    // REGEX SAFETY NET FOR PLATES (Indian Format)
    if (!parsed || !parsed.vehicleNo || parsed.vehicleNo.length < 5) {
       log(`[Plate-OCR] AI failed. Running regex fallback.`);
       // Match common formats: MH12AB1234, MH 12 AB 1234, etc.
       const regex = /[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}/i; 
       const cleanText = text.replace(/[\s-]/g, '');
       const match = cleanText.match(regex);
       if (!parsed) parsed = {};
       if (match) {
         parsed.vehicleNo = match[0].toUpperCase();
       } else {
         // Even broader fallback if the structured regex fails
         const broadMatch = text.match(/[A-Z0-9]{5,12}/i);
         if (broadMatch) parsed.vehicleNo = broadMatch[0].toUpperCase();
       }
    }

    if (parsed && parsed.vehicleNo) {
       // Final normalization: remove spaces
       parsed.vehicleNo = parsed.vehicleNo.replace(/[\s-]/g, '').toUpperCase();
    }

    log(`[Plate-OCR] Final Parsed: ${JSON.stringify(parsed)}`);
    return parsed;

  } catch (err) {
    log(`[Plate-OCR] CRITICAL ERROR: ${err.message}`);
    return { vehicleNo: null };
  }
};

module.exports = { processChallanImage, processPlateImage };
