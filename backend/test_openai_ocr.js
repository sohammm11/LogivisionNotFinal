require('dotenv').config();
const { runOpenAIParsing } = require('./services/ocr.service');

async function test() {
    console.log('--- Testing OpenAI Connectivity ---');

    const sampleText = `
    LOGIVISION LOGISTICS
    Challan No: CLN-2026-04471
    Vendor: Fresh Foods Corp
    Cargo: Apples - 50 Boxes, Oranges - 20 Boxes
    Weight: 1200 kg
    Destination: Warehouse WH-001
    Load: FULL
  `;

    try {
        console.log('\nTesting OpenAI Parsing with sample text...');
        const result = await runOpenAIParsing(sampleText, 'challan');
        console.log('OpenAI Result:', JSON.stringify(result, null, 2));

        if (result.vendorName && result.vendorName !== "Missing OpenAI API Key") {
            console.log('\nSUCCESS: OpenAI successfully parsed the data.');
        } else {
            console.log('\nFAILURE: OpenAI returned unexpected data or error labels.');
        }

    } catch (err) {
        console.error('Test failed:', err.message);
    }
}

test();
