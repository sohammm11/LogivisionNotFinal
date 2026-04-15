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
  console.log('[DEBUG] Hard-Fix OCR initiated');
  const { mimeType, base64Data } = parseImageSource(imageSource);
  
  if (!base64Data) throw new Error('Invalid image data');

  log(`[Gemini-HardFix] Processing. MIME: ${mimeType}, Size: ${base64Data.length}`);

  // Use the most stable commercial model for handwritten docs
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = `You are a professional logistics data extractor. 
  ANALYZE THIS HANDWRITTEN INDIAN CHALLAN IMAGE.
  The text is in English and Hindi/Marathi (Devanagari).
  
  EXTRACT THESE BOLD FIELDS:
  1. Challan ID (usually starts with CLN)
  2. Truck number (registration plate number)
  3. From (Sender name)
  4. To (Receiver/Destination)
  5. Goods Description (Items/Cargo)
  6. Weight (Total weight in Tons/Kg)
  7. Total value (Amount)
  8. Capacity (Full/Half/Empty)
  
  OUTPUT REQUIREMENT:
  Return ONLY a valid JSON object. No markdown. No comments. No conversational filler.
  JSON Schema:
  {
    "challan_number": "string or null",
    "truck_number": "string or null",
    "from": "string or null",
    "to": "string or null",
    "goods_description": "string or null",
    "weight": "string or null",
    "total_value": "string or null",
    "capacity": "string or null",
    "date": "string or null"
  }`;

  try {
    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      { text: prompt }
    ]);

    const text = (await result.response).text();
    log(`[Gemini-HardFix] RAW RESULT:\n${text}`);

    let parsed = extractJson(text);
    
    // IF PARSING FAILED, TRY A LAST-GASP REGEX FOR THE TRUCK NUMBER
    if (!parsed || !parsed.truck_number) {
       log(`[Gemini-HardFix] Standard JSON failed or truck number missing. Running Regex Safety Net.`);
       const truckMatch = text.match(/[A-Z]{2}\s?[0-9]{2}\s?[A-Z]{0,2}\s?[0-9]{4}/i);
       if (!parsed) parsed = {};
       if (truckMatch) parsed.truck_number = truckMatch[0].toUpperCase();
    }

    log(`[Gemini-HardFix] FINAL OUTPUT: ${JSON.stringify(parsed)}`);
    return parsed;

  } catch (err) {
    log(`[Gemini-HardFix] FATAL ERROR: ${err.message}`);
    return { challan_number: null, truck_number: null, from: null, to: null, goods_description: null, weight: null, total_value: null, capacity: null, date: null };
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
