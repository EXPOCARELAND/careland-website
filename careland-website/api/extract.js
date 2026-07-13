export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables' });

  const { text, category, pageNum, totalPages } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const prompt = `You are extracting ALL surgical instrument product listings from a catalog page for CARELAND Surgical Instruments, Sialkot, Pakistan — an ISO 9001:2022 and ISO 13485:2016 certified manufacturer exporting to 40+ countries.

Category: ${category}
Page: ${pageNum} of ${totalPages}

IMPORTANT RULES:
1. Extract EVERY SINGLE product listed. Do NOT skip any. No limit.
2. If a product has multiple sizes/types, list EACH as a separate product entry.
3. Price must always be empty string "".
4. Include SEO keywords naturally in descriptions.
5. Add relevant hashtags at end of each description.

For each product return a JSON array entry with these exact fields:
{
  "name": "Full product name with size/type/model number if mentioned",
  "desc": "HTML description with SEO keywords and hashtags — see format below",
  "material": "Material mentioned or 'German Stainless Steel'",
  "grade": "ISO 9001:2022 · ISO 13485:2016 · CE Certified",
  "price": "",
  "discount": ""
}

DESCRIPTION HTML FORMAT (follow exactly):
<h3 style="color:#166534;margin-bottom:6px">CARELAND [Product Name]</h3>
<p>[Clinical use — what surgery/procedure it is used in. Be specific. 2 sentences.]</p>
<p>Manufactured by <strong>CARELAND Surgical Instruments</strong>, Sialkot, Pakistan — <em>ISO 9001:2022 &amp; ISO 13485:2016 certified</em> surgical instrument manufacturer and exporter. Made from [material], precision-forged for superior strength and durability. Autoclavable and reusable.</p>
<ul style="margin-left:16px;margin-bottom:8px;font-size:13px">
<li>Material: [material] — highest grade for surgical use</li>
<li>Finish: Mirror-polished, corrosion resistant</li>
<li>Sterilization: Autoclave, EO gas, chemical compatible</li>
<li>Available for bulk orders and OEM/private labeling</li>
</ul>
<p style="font-size:12px;color:#2563eb;margin-top:6px">#${category.replace(/ /g,'').replace(/&/g,'')}Instruments #SurgicalInstruments #MedicalInstruments #CARELAND #SialkotPakistan #ISO9001 #ISO13485 #CECertified #MedicalDevices #SurgicalTools #OrthopedicSurgery #GermanStainlessSteel #SurgicalInstrumentsManufacturer #MedicalSupplies #HealthcareEquipment #SurgicalInstrumentsPakistan #MadeInSialkot</p>

Return ONLY a valid JSON array. No explanation. No markdown code blocks. Just the raw JSON array starting with [ and ending with ].
If no products on this page return [].

CATALOG TEXT:
${text.substring(0, 7000)}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: 'Invalid API response' });
    }

    let content = data.content[0].text.trim();
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const products = JSON.parse(content);
      res.json({ products: Array.isArray(products) ? products : [] });
    } catch {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        try { res.json({ products: JSON.parse(match[0]) }); }
        catch { res.json({ products: [], raw: content.substring(0, 300) }); }
      } else {
        res.json({ products: [], raw: content.substring(0, 300) });
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
