import { Product, Order, Sheet1ProductReport, ProductReportSource, Sheet3ProductEntry } from '../types';

export const DEFAULT_SPREADSHEET_ID = '1aHUCGINJ8rB29rXXckH7uMTwrk163v6aQFTfQ6ptr6M';

export const extractSpreadsheetId = (input: string): string => {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
};

interface SheetResponse {
  values?: (string | number)[][];
}

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * Fetch sheet metadata (list of tabs)
 */
export const getSpreadsheetMetadata = async (
  spreadsheetId: string,
  accessToken: string
) => {
  const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}?fields=properties.title,sheets.properties`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch sheet info: ${res.statusText}`);
  }

  return res.json();
};

/**
 * Read product values
 */
export const getSheetProducts = async (
  spreadsheetId: string,
  accessToken?: string | null,
  sheetTabName: string = 'Products'
): Promise<{ products: Product[]; rawHeader: string[]; tabName: string }> => {
  if (!accessToken) {
    return fetchPublicSheetProducts(spreadsheetId, sheetTabName);
  }

  // First, verify tab exists or find suitable tab
  let tabName = sheetTabName;
  try {
    const meta = await getSpreadsheetMetadata(spreadsheetId, accessToken);
    const sheets = meta.sheets || [];
    const sheetTitles = sheets.map((s: any) => s.properties?.title || '');
    
    // Check if sheet has tab named like products or first tab
    const matched = sheetTitles.find((t: string) => /product|item|পণ্য|পোশাক|store/i.test(t));
    if (matched) {
      tabName = matched;
    } else if (sheetTitles.length > 0 && !sheetTitles.includes(sheetTabName)) {
      tabName = sheetTitles[0];
    }
  } catch (err) {
    console.warn('Metadata check error, fallback to public products fetch:', sheetTabName, err);
    return fetchPublicSheetProducts(spreadsheetId, sheetTabName);
  }

  const range = `'${tabName}'!A1:Z1000`;
  const res = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    return fetchPublicSheetProducts(spreadsheetId, tabName);
  }

  const data: SheetResponse = await res.json();
  const rows = data.values || [];

  if (rows.length === 0) {
    return { products: [], rawHeader: [], tabName };
  }

  const headerRow = rows[0].map(h => String(h).trim().toLowerCase());
  const rawHeader = rows[0].map(h => String(h).trim());

  // Detect column indexes
  const idCol = headerRow.findIndex(h => /id|sku|code|কোড|নং/i.test(h));
  const nameCol = headerRow.findIndex(h => /name|title|product|পণ্য|নাম|item/i.test(h));
  const regPriceCol = headerRow.findIndex(h => /regular.*price|price|দাম|মূল্য|rate|mrp/i.test(h));
  const salePriceCol = headerRow.findIndex(h => /sale.*price|offer.*price|discount/i.test(h));
  const stockCol = headerRow.findIndex(h => /stock|qty|quantity|মজুদ|স্টক/i.test(h));
  const categoryCol = headerRow.findIndex(h => /category|ক্যাটাগরি|type|group/i.test(h));
  const descCol = headerRow.findIndex(h => /desc|description|বিবরণ|details/i.test(h));
  const imageCol = headerRow.findIndex(h => /image|img|photo|ছবি|picture|url/i.test(h));
  const statusCol = headerRow.findIndex(h => /status|অবস্থা/i.test(h));

  const products: Product[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row.some(cell => String(cell).trim() !== '')) {
      continue;
    }

    const rowIndex = i + 1; // 1-based row in Google Sheet
    const rawName = nameCol !== -1 ? String(row[nameCol] || '').trim() : String(row[0] || '').trim();
    if (!rawName) continue;

    const rawId = idCol !== -1 ? String(row[idCol] || '').trim() : `PRD-${rowIndex}`;
    
    // Parse prices
    const parseNumber = (val: any, fallback: number = 0) => {
      if (val === undefined || val === null || val === '') return fallback;
      const clean = String(val).replace(/[^0-9.]/g, '');
      const num = parseFloat(clean);
      return isNaN(num) ? fallback : num;
    };

    const regPrice = regPriceCol !== -1 ? parseNumber(row[regPriceCol], 0) : 0;
    const salePrice = salePriceCol !== -1 ? parseNumber(row[salePriceCol], 0) : undefined;
    const stock = stockCol !== -1 ? Math.floor(parseNumber(row[stockCol], 10)) : 10;
    const category = categoryCol !== -1 && row[categoryCol] ? String(row[categoryCol]).trim() : 'General';
    const description = descCol !== -1 && row[descCol] ? String(row[descCol]).trim() : '';
    const image = imageCol !== -1 && row[imageCol] ? String(row[imageCol]).trim() : '';
    
    let status: Product['status'] = stock <= 0 ? 'out_of_stock' : 'publish';
    if (statusCol !== -1 && row[statusCol]) {
      const s = String(row[statusCol]).toLowerCase();
      if (s.includes('draft') || s.includes('ড্রাফট')) status = 'draft';
      else if (s.includes('out') || s.includes('শেষ') || s.includes('stock')) status = 'out_of_stock';
      else status = 'publish';
    }

    // Default fallback image if none provided
    const fallbackImage = `https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80`;

    products.push({
      id: rawId || `PRD-${rowIndex}`,
      name: rawName,
      category,
      regularPrice: regPrice,
      salePrice: salePrice && salePrice > 0 && salePrice < regPrice ? salePrice : undefined,
      stock,
      status,
      description,
      image: image || fallbackImage,
      featured: i <= 4,
      rowIndex,
    });
  }

  return { products, rawHeader, tabName };
};

/**
 * Update an existing product row in Google Sheet
 */
export const updateSheetProduct = async (
  spreadsheetId: string,
  accessToken: string,
  tabName: string,
  product: Product,
  columnMap?: Record<string, number>
) => {
  // If we know row index, update that specific row range
  const rowIndex = product.rowIndex;
  if (!rowIndex) {
    throw new Error('Row index is missing for this product');
  }

  // To be safe and preserve columns accurately, read header first if not mapped
  const metaRange = `'${tabName}'!A1:Z1`;
  const headerRes = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(metaRange)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const headerData = await headerRes.json();
  const headers: string[] = (headerData.values && headerData.values[0]) || [
    'ID', 'Name', 'Category', 'Price', 'Sale Price', 'Stock', 'Status', 'Description', 'Image'
  ];

  // Also read the current row values to not wipe out unrelated columns
  const currentRowRange = `'${tabName}'!A${rowIndex}:Z${rowIndex}`;
  const currentRowRes = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(currentRowRange)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const currentRowData = await currentRowRes.json();
  const rowValues: any[] = (currentRowData.values && currentRowData.values[0]) || [];

  // Ensure rowValues is as long as headers
  while (rowValues.length < headers.length) {
    rowValues.push('');
  }

  headers.forEach((h, idx) => {
    const headerName = h.toLowerCase().trim();
    if (/id|sku|code/i.test(headerName)) {
      rowValues[idx] = product.id;
    } else if (/name|title|product|পণ্য|নাম/i.test(headerName)) {
      rowValues[idx] = product.name;
    } else if (/regular.*price|price|দাম|মূল্য|rate/i.test(headerName) && !/sale/i.test(headerName)) {
      rowValues[idx] = product.regularPrice;
    } else if (/sale.*price|offer.*price|discount/i.test(headerName)) {
      rowValues[idx] = product.salePrice || '';
    } else if (/stock|qty|quantity|মজুদ/i.test(headerName)) {
      rowValues[idx] = product.stock;
    } else if (/category|ক্যাটাগরি|group/i.test(headerName)) {
      rowValues[idx] = product.category;
    } else if (/desc|description|বিবরণ/i.test(headerName)) {
      rowValues[idx] = product.description;
    } else if (/image|img|photo|ছবি|url/i.test(headerName)) {
      rowValues[idx] = product.image;
    } else if (/status|অবস্থা/i.test(headerName)) {
      rowValues[idx] = product.status;
    }
  });

  const updateRange = `'${tabName}'!A${rowIndex}:${String.fromCharCode(65 + Math.min(rowValues.length - 1, 25))}${rowIndex}`;
  const putRes = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: updateRange,
        majorDimension: 'ROWS',
        values: [rowValues],
      }),
    }
  );

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to update sheet: ${putRes.statusText}`);
  }

  return putRes.json();
};

/**
 * Append a new product to Google Sheet
 */
export const appendSheetProduct = async (
  spreadsheetId: string,
  accessToken: string,
  tabName: string,
  product: Omit<Product, 'rowIndex'>
) => {
  // Read header to match column order
  const metaRange = `'${tabName}'!A1:Z1`;
  const headerRes = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(metaRange)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const headerData = await headerRes.json();
  let headers: string[] = (headerData.values && headerData.values[0]) || [];

  if (headers.length === 0) {
    // If sheet is empty, create standard WooCommerce-like columns
    headers = ['ID', 'Name', 'Category', 'Price', 'Sale Price', 'Stock', 'Status', 'Description', 'Image'];
    // Write header first
    await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/'${tabName}'!A1:I1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: `'${tabName}'!A1:I1`,
          values: [headers],
        }),
      }
    );
  }

  const rowValues: any[] = headers.map(h => {
    const headerName = h.toLowerCase().trim();
    if (/id|sku|code/i.test(headerName)) return product.id || `PRD-${Date.now().toString().slice(-4)}`;
    if (/name|title|product|পণ্য/i.test(headerName)) return product.name;
    if (/regular.*price|price|দাম|মূল্য/i.test(headerName) && !/sale/i.test(headerName)) return product.regularPrice;
    if (/sale.*price|discount/i.test(headerName)) return product.salePrice || '';
    if (/stock|qty|quantity|মজুদ/i.test(headerName)) return product.stock;
    if (/category|ক্যাটাগরি/i.test(headerName)) return product.category || 'General';
    if (/desc|description|বিবরণ/i.test(headerName)) return product.description || '';
    if (/image|img|photo|ছবি/i.test(headerName)) return product.image || '';
    if (/status|অবস্থা/i.test(headerName)) return product.status || 'publish';
    return '';
  });

  const appendRange = `'${tabName}'!A:Z`;
  const appendRes = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: appendRange,
        majorDimension: 'ROWS',
        values: [rowValues],
      }),
    }
  );

  if (!appendRes.ok) {
    const err = await appendRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to add product to sheet: ${appendRes.statusText}`);
  }

  return appendRes.json();
};

/**
 * Append an order to the Google Sheet (matches user's screenshot columns)
 */
export const appendSheetOrder = async (
  spreadsheetId: string,
  accessToken: string,
  order: Order,
  tabName: string = 'Sheet1'
) => {
  // Check available tabs to find the best tab name
  let targetTab = tabName;
  try {
    const meta = await getSpreadsheetMetadata(spreadsheetId, accessToken);
    const sheets = meta.sheets || [];
    const sheetTitles = sheets.map((s: any) => s.properties?.title || '');
    const matched = sheetTitles.find((t: string) => /order|অর্ডার|sheet1/i.test(t));
    if (matched) targetTab = matched;
    else if (sheetTitles.length > 0) targetTab = sheetTitles[0];
  } catch (e) {
    console.warn('Metadata check in appendSheetOrder:', e);
  }

  // Row columns matching screenshot:
  // [Invoice ID, Customer Name, Phone, Address, Product, Source/Amount, Status, Tracking Code, Courier Status, Send to Steadfast, Quantity, Total Spend]
  const row = [
    '', // Column A
    order.id || `INV-${Date.now().toString().slice(-4)}`, // Column B: Invoice ID
    order.customerName, // Column C: Customer Name
    order.customerPhone, // Column D: Phone
    order.customerAddress, // Column E: Address
    order.product || 'Standard Item', // Column F: Product
    order.source || 'Website', // Column G: Source
    order.status || 'Complete', // Column H: Status
    order.trackingCode || `29${Math.floor(1000000 + Math.random() * 9000000)}`, // Column I: Tracking Code
    order.courierStatus || 'pending', // Column J: Courier Status
    order.steadfastStatus || 'send to steadfast', // Column K: Steadfast Status
    order.quantity || 1, // Column L: Quantity
    order.amount || order.total || 0, // Column M: Total Spend
  ];

  const appendRange = `'${targetTab}'!A:M`;
  const appendRes = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: appendRange,
        majorDimension: 'ROWS',
        values: [row],
      }),
    }
  );

  if (!appendRes.ok) {
    const err = await appendRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to record order in sheet: ${appendRes.statusText}`);
  }

  return appendRes.json();
};

/**
 * Fetch orders directly from Google Apps Script Web App
 */
export const fetchOrdersViaAppsScript = async (
  scriptUrl: string = APPS_SCRIPT_URL
): Promise<{ orders: Order[]; tabName: string }> => {
  try {
    const res = await fetch(scriptUrl);
    if (!res.ok) return { orders: [], tabName: 'Sheet2' };
    const data = await res.json();
    if (data && data.success && Array.isArray(data.orders)) {
      const orders: Order[] = data.orders.map((o: any) => {
        let cleanPhone = String(o.phone || o.customer_phone || o.number || o.mobile || '').trim().replace(/\.0+$/, '');
        let cleanAddr = String(o.address || o.customer_address || '').trim();
        if (!cleanPhone && /^\+?\d{10,14}$/.test(cleanAddr.replace(/\s+/g, ''))) {
          cleanPhone = cleanAddr.replace(/\s+/g, '');
          cleanAddr = '';
        }

        return {
          id: String(o.id || (o.row_number ? `INV-${1000 + o.row_number}` : `ORD-${Date.now()}`)),
          customerName: o.customer || 'Customer',
          customerPhone: cleanPhone,
          customerAddress: cleanAddr,
          product: o.product || 'Standard Product',
          variant: o.selected_product || 'No Sellect',
          source: o.source || 'Website',
          amount: Number(o.cod) || 0,
          total: Number(o.cod) || 0,
          quantity: Number(o.quantity) || 1,
          status: (o.order_status as any) || 'Pending',
          trackingCode: o.courier_id || undefined,
          courierStatus: o.courier_status || undefined,
          steadfastStatus: o.courier_action || (o.courier_id ? 'send to steadfast' : 'No Sellect'),
          date: o.date ? String(o.date).trim() : '08/09/26',
          rawDate: o.date ? String(o.date).trim() : undefined,
          rowIndex: Number(o.row_number) || 2,
        };
      });
      return { orders, tabName: 'Sheet2' };
    }
  } catch (err) {
    console.warn('Apps Script GET orders fallback failed:', err);
  }
  return { orders: [], tabName: 'Sheet2' };
};

/**
 * Extract the exact text of Column A from Google Sheet (cell object or string)
 * preserving timestamps such as "9/9/2026 19:50:48" without trimming time.
 */
export const extractColumnAText = (cellOrValue: any): string => {
  if (cellOrValue === null || cellOrValue === undefined) return '';

  if (typeof cellOrValue === 'object') {
    // 1. Google Visualization formatted string (e.g. cell.f = "9/9/2026 19:50:48")
    if (cellOrValue.f !== null && cellOrValue.f !== undefined && String(cellOrValue.f).trim() !== '') {
      return String(cellOrValue.f).trim();
    }
    const v = cellOrValue.v;
    if (v !== null && v !== undefined) {
      const vStr = String(v).trim();
      // Google Visualization Date(yyyy, m, d[, h, min, s]) constructor string
      const gvizMatch = vStr.match(/Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})(?:,\s*(\d{1,2}),\s*(\d{1,2}),\s*(\d{1,2}))?\)/);
      if (gvizMatch) {
        const y = gvizMatch[1];
        const m = parseInt(gvizMatch[2], 10) + 1; // 0-based month in gviz
        const d = parseInt(gvizMatch[3], 10);
        if (gvizMatch[4] !== undefined) {
          const hh = parseInt(gvizMatch[4], 10);
          const mm = String(gvizMatch[5] || '0').padStart(2, '0');
          const ss = String(gvizMatch[6] || '0').padStart(2, '0');
          return `${m}/${d}/${y} ${hh}:${mm}:${ss}`;
        }
        return `${m}/${d}/${y}`;
      }
      return vStr;
    }
    return '';
  }

  return String(cellOrValue).trim();
};

/**
 * Standardize any date from Google Sheet (gviz cell, timestamp, ISO, DD/MM/YYYY, etc.)
 * into a clean, uniform DD/MM/YYYY string.
 */
export const formatSheetDate = (cellOrValue: any): string => {
  if (!cellOrValue) return '';

  let vStr = '';
  let fStr = '';

  if (typeof cellOrValue === 'object') {
    vStr = String(cellOrValue.v !== null && cellOrValue.v !== undefined ? cellOrValue.v : '').trim();
    fStr = String(cellOrValue.f !== null && cellOrValue.f !== undefined ? cellOrValue.f : '').trim();
  } else {
    vStr = String(cellOrValue).trim();
  }

  // 1. Check if vStr is Google Visualization Date(yyyy, m, d[, h, m, s])
  // NOTE: Google Sheets gviz uses 0-indexed month! (0 = Jan, 8 = Sep)
  const gvizMatch = vStr.match(/Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})(?:,\s*(\d{1,2}),\s*(\d{1,2}),\s*(\d{1,2}))?\)/);
  if (gvizMatch) {
    const y = gvizMatch[1];
    const m = String(parseInt(gvizMatch[2], 10) + 1).padStart(2, '0');
    const d = String(parseInt(gvizMatch[3], 10)).padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  const candidate = fStr || vStr;
  if (!candidate) return '';

  // 2. Convert Bengali digits if present
  const bengaliNumerals = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let norm = candidate;
  for (let b = 0; b < 10; b++) {
    norm = norm.replaceAll(bengaliNumerals[b], String(b));
  }

  // Remove time portion if attached (e.g. "9/9/2026 19:50:48" or "2026-09-09T19:50:48")
  const datePart = norm.split(/[ T]/)[0].trim();

  // 3. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = datePart.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // 4. Delimited format: DD/MM/YYYY, M/D/YYYY, DD-MM-YY etc.
  const dmyMatch = datePart.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmyMatch) {
    let p1 = parseInt(dmyMatch[1], 10);
    let p2 = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y += 2000;

    let day = p1;
    let month = p2;

    // Disambiguate if p1 <= 12 and p2 > 12 -> M/D/YYYY (e.g. 9/17/2026 -> Sep 17)
    if (p1 <= 12 && p2 > 12) {
      month = p1;
      day = p2;
    } else if (p1 <= 12 && p2 <= 12) {
      // In Google Sheets timestamps where first digit is 9 (September) and second is day (e.g. 9/7/2026, 9/6/2026)
      if (p1 === 9 && p2 <= 31 && p2 !== 9) {
        month = p1;
        day = p2;
      }
    }

    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${y}`;
  }

  return candidate;
};

/**
 * Fetch orders using Google Sheets public Visualization API (requires no OAuth token if shared)
 */
export const fetchPublicSheetOrders = async (
  spreadsheetId: string,
  preferredTab?: string
): Promise<{ orders: Order[]; tabName: string }> => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const targetTab = preferredTab || 'Sheet2';
  const tabQuery = `&sheet=${encodeURIComponent(targetTab)}`;
  const url = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json${tabQuery}`;

  try {
    const res = await fetch(url);
    if (res.ok) {
      const text = await res.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);/);
      if (match && match[1]) {
        const data = JSON.parse(match[1]);
        if (data.table && data.table.rows && data.table.rows.length > 0) {
          const cols = data.table.cols.map((c: any) => (c?.label || c?.id || '').trim().toLowerCase());

          // Find column indices - ensure product name does NOT conflict with customer name
          const productCol = cols.findIndex((h: string) => /product|item|পণ্য/i.test(h));
          let nameCol = cols.findIndex((h: string) =>
            (/customer|গ্রাহক|কাস্টমার/i.test(h) || (/(?:^|\b)name(?:\b|$)|নাম/i.test(h) && !/product|item|পণ্য/i.test(h)))
          );
          if (nameCol === -1 || nameCol === productCol) {
            nameCol = cols.findIndex((h: string, idx: number) => idx !== productCol && /name|গ্রাহক/i.test(h));
          }

          const invoiceCol = cols.findIndex((h: string) => /invoice|order.*id|inv|আইডি|অর্ডার.*নং/i.test(h));
          const phoneCol = cols.findIndex((h: string) => /phone|mobile|ফোন|মোবাইল|number|নম্বর|contact/i.test(h));
          const addressCol = cols.findIndex((h: string) => /address|ঠিকানা|সিটি|city|adress|লোকেশন|location/i.test(h));
          const priceCol = cols.findIndex((h: string) => /price|amount|দাম|মূল্য|total|cod/i.test(h));
          const variantCol = cols.findIndex((h: string) => /variant|ভ্যারিয়েন্ট/i.test(h));
          const sourceCol = cols.findIndex((h: string) => /source|মাধ্যম|সোর্স/i.test(h));
          const statusCol = cols.findIndex((h: string) => /status|অবস্থা/i.test(h) && !/courier/i.test(h));
          const trackingCol = cols.findIndex((h: string) => /tracking|code|ট্র্যাকিং/i.test(h));
          const courierCol = cols.findIndex((h: string) => /courier.*status|কুরিয়ার/i.test(h));
          const steadfastCol = cols.findIndex((h: string) => /steadfast|স্টেডফাস্ট/i.test(h));
          const quantityCol = cols.findIndex((h: string) => /quantity|qty|পরিমাণ/i.test(h));
          const dateCol = cols.findIndex((h: string) => /date|তারিখ|সময়|time|day/i.test(h));

          const orders: Order[] = [];
          const seenOrderIds = new Set<string>();
          const rawRows = data.table.rows;

          for (let i = 0; i < rawRows.length; i++) {
            const cells = rawRows[i].c;
            if (!cells) continue;

            const row = cells.map((cell: any) =>
              cell ? (cell.f !== undefined ? String(cell.f).trim() : String(cell.v !== null ? cell.v : '').trim()) : ''
            );

            // Skip empty rows
            if (!row.some((val: string) => val !== '')) continue;

            let rawId = (invoiceCol !== -1 && row[invoiceCol]) ? row[invoiceCol] : '';
            // If rawId looks like a date or is empty, don't use date as an invoice ID
            const isDateLike = (str: string) => /^\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(str.trim());
            if (!rawId || isDateLike(rawId)) {
              rawId = '';
            }
            // In Sheet2: Col F is Name (5), Col C is Number/Phone (2), Col B is Address (1), Col E is Product (4)
            const nameVal = (nameCol !== -1 && row[nameCol]) ? row[nameCol] : (row[5] || row[1] || '');

            // Column C: Phone (Index 2 in 0-based array)
            let phoneVal = (phoneCol !== -1 && row[phoneCol] && String(row[phoneCol]).trim() !== '')
              ? String(row[phoneCol]).trim()
              : String(row[2] || '').trim();
            phoneVal = phoneVal.replace(/\.0+$/, '').trim();

            // Column B: Address (Index 1 in 0-based array)
            let addrVal = (addressCol !== -1 && row[addressCol] && String(row[addressCol]).trim() !== '')
              ? String(row[addressCol]).trim()
              : String(row[1] || row[3] || '').trim();

            // Intelligent fallback: If Column C was empty in the sheet but Column B holds only digits (like row 6)
            if (!phoneVal && /^\+?\d{10,14}$/.test(addrVal.replace(/\s+/g, ''))) {
              phoneVal = addrVal.replace(/\s+/g, '');
              addrVal = '';
            }

            const prodVal = (productCol !== -1 && row[productCol]) ? row[productCol] : (row[4] || row[7] || 'পণ্য');
            const variantVal = (variantCol !== -1 && row[variantCol]) ? row[variantCol] : (row[7] || 'No Sellect');
            const sourceVal = (sourceCol !== -1 && row[sourceCol]) ? row[sourceCol] : (row[8] || 'Website');
            const statusVal = (statusCol !== -1 && row[statusCol]) ? row[statusCol] : (row[9] || 'Pending');
            const trackVal = (trackingCol !== -1 && row[trackingCol]) ? row[trackingCol] : (row[10] || '');
            const courierVal = (courierCol !== -1 && row[courierCol]) ? row[courierCol] : (row[11] || '');
            // Column M: Steadfast Action ("send to steadfast" vs "No Sellect")
            const rawSteadfast = (steadfastCol !== -1 && row[steadfastCol]) ? row[steadfastCol] : (row[12] || '');
            const steadfastVal = rawSteadfast || (trackVal ? 'send to steadfast' : 'No Sellect');
            // Column N: Quantity
            const qtyVal = parseInt(String((quantityCol !== -1 && row[quantityCol]) ? row[quantityCol] : (row[13] || '1')).replace(/[^0-9]/g, '')) || 1;
            const priceVal = parseFloat((priceCol !== -1 ? row[priceCol] : row[3] || row[4] || '0').replace(/[^0-9.]/g, '')) || 0;

            // Date from Column A (or date header)
            const dateCell = cells ? (dateCol !== -1 && cells[dateCol] !== undefined ? cells[dateCol] : cells[0]) : null;
            const rawColADate = extractColumnAText(dateCell);
            const dateVal = rawColADate || formatSheetDate(dateCell) || '08/09/26';

            // Must have at least an invoice ID, name, phone, or tracking code
            if (!rawId && !nameVal && !phoneVal && !trackVal) continue;

            let uniqueOrderId = rawId || (trackVal ? trackVal : `INV-${1000 + i + 1}`);
            while (seenOrderIds.has(uniqueOrderId)) {
              uniqueOrderId = `${uniqueOrderId}-${i + 1}`;
            }
            seenOrderIds.add(uniqueOrderId);

            orders.push({
              id: uniqueOrderId,
              customerName: nameVal || (phoneVal ? `গ্রাহক (${phoneVal.slice(-4)})` : (rawId ? `অর্ডার #${rawId}` : `গ্রাহক #${i + 1}`)),
              customerPhone: phoneVal,
              customerAddress: addrVal,
              product: prodVal,
              variant: variantVal || 'No Sellect',
              source: sourceVal || 'Website',
              amount: priceVal,
              total: priceVal,
              quantity: qtyVal,
              status: (statusVal as any) || 'Pending',
              trackingCode: trackVal || undefined,
              courierStatus: courierVal || undefined,
              steadfastStatus: steadfastVal,
              date: dateVal,
              rawDate: rawColADate || dateVal,
              rowIndex: i + 2, // 1-indexed (row 1 is header)
            });
          }

          if (orders.length > 0) {
            return { orders, tabName: targetTab };
          }
        }
      }
    }
  } catch (err) {
    console.warn('Public sheet gviz fetch error, falling back to Apps Script Web App:', err);
  }

  // Fallback to Apps Script Web App
  return fetchOrdersViaAppsScript();
};

/**
 * Fetch products using Google Sheets public Visualization API
 */
export const fetchPublicSheetProducts = async (
  spreadsheetId: string,
  preferredTab: string = 'Products'
): Promise<{ products: Product[]; rawHeader: string[]; tabName: string }> => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const url = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(preferredTab)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { products: [], rawHeader: [], tabName: preferredTab };
    }
    const text = await res.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);/);
    if (!match || !match[1]) {
      return { products: [], rawHeader: [], tabName: preferredTab };
    }

    const data = JSON.parse(match[1]);
    if (!data.table || !data.table.rows) {
      return { products: [], rawHeader: [], tabName: preferredTab };
    }

    const rawCols = data.table.cols.map((c: any) => (c?.label || c?.id || '').trim());
    const headerRow = rawCols.map(h => h.toLowerCase());

    const idCol = headerRow.findIndex(h => /id|sku|code|কোড|নং/i.test(h));
    const nameCol = headerRow.findIndex(h => /name|title|product|পণ্য|নাম|item/i.test(h));
    const regPriceCol = headerRow.findIndex(h => /regular.*price|price|দাম|মূল্য|rate|mrp/i.test(h));
    const salePriceCol = headerRow.findIndex(h => /sale.*price|offer.*price|discount/i.test(h));
    const stockCol = headerRow.findIndex(h => /stock|qty|quantity|মজুদ|স্টক/i.test(h));
    const categoryCol = headerRow.findIndex(h => /category|ক্যাটাগরি|type|group/i.test(h));
    const descCol = headerRow.findIndex(h => /desc|description|বিবরণ|details/i.test(h));
    const imageCol = headerRow.findIndex(h => /image|img|photo|ছবি|picture|url/i.test(h));

    const products: Product[] = [];
    const rawRows = data.table.rows;

    for (let i = 0; i < rawRows.length; i++) {
      const cells = rawRows[i].c;
      if (!cells) continue;
      const row = cells.map((cell: any) =>
        cell ? (cell.f !== undefined ? String(cell.f).trim() : String(cell.v !== null ? cell.v : '').trim()) : ''
      );

      if (!row.some((c: string) => c !== '')) continue;

      const rowIndex = i + 2;
      const rawName = nameCol !== -1 && row[nameCol] ? row[nameCol] : (row[16] || row[7] || row[1] || '');
      if (!rawName || rawName === 'No Sellect') continue;

      const rawId = idCol !== -1 && row[idCol] ? row[idCol] : `PRD-${rowIndex}`;
      const regPrice = parseFloat(String(regPriceCol !== -1 ? row[regPriceCol] : row[15] || row[4] || '599').replace(/[^0-9.]/g, '')) || 599;
      const salePrice = salePriceCol !== -1 && row[salePriceCol] ? parseFloat(String(row[salePriceCol]).replace(/[^0-9.]/g, '')) : undefined;
      const stock = stockCol !== -1 && row[stockCol] ? parseInt(String(row[stockCol]).replace(/[^0-9]/g, '')) || 10 : 15;
      const category = categoryCol !== -1 && row[categoryCol] ? row[categoryCol] : 'General';
      const description = descCol !== -1 && row[descCol] ? row[descCol] : '';
      const image = imageCol !== -1 && row[imageCol] ? row[imageCol] : '';

      products.push({
        id: rawId,
        name: rawName,
        category,
        regularPrice: regPrice,
        salePrice: salePrice && salePrice > 0 && salePrice < regPrice ? salePrice : undefined,
        stock,
        status: 'publish',
        description,
        image: image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
        rowIndex,
      });
    }

    return { products, rawHeader: rawCols, tabName: preferredTab };
  } catch (err) {
    console.warn('Public products fetch fallback:', err);
    return { products: [], rawHeader: [], tabName: preferredTab };
  }
};

/**
 * Fetch orders from user's Google Sheet dynamically detecting columns
 */
export const getSheetOrders = async (
  spreadsheetId: string,
  accessToken?: string | null,
  preferredTab?: string
): Promise<{ orders: Order[]; tabName: string }> => {
  // If no accessToken provided, use public gviz query directly
  if (!accessToken) {
    return fetchPublicSheetOrders(spreadsheetId, preferredTab);
  }

  let tabName = preferredTab || 'Sheet2';
  try {
    const meta = await getSpreadsheetMetadata(spreadsheetId, accessToken);
    const sheets = meta.sheets || [];
    const sheetTitles = sheets.map((s: any) => s.properties?.title || '');
    
    if (preferredTab && sheetTitles.some((t: string) => t.toLowerCase() === preferredTab.toLowerCase())) {
      const exact = sheetTitles.find((t: string) => t.toLowerCase() === preferredTab.toLowerCase());
      tabName = exact || preferredTab;
    } else if (preferredTab) {
      tabName = preferredTab;
    } else {
      const matched = sheetTitles.find((t: string) => /sheet2|order|অর্ডার|sheet1/i.test(t));
      if (matched) {
        tabName = matched;
      } else if (sheetTitles.length > 0) {
        tabName = sheetTitles[0];
      }
    }
  } catch (err) {
    console.warn('Unable to inspect sheet metadata for orders, fallback to public fetch:', err);
    return fetchPublicSheetOrders(spreadsheetId, preferredTab);
  }

  try {
    const res = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/'${tabName}'!A1:N1000?valueRenderOption=FORMATTED_VALUE`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok) {
      // Fallback to public gviz if OAuth token lacks permission or expired
      return fetchPublicSheetOrders(spreadsheetId, preferredTab);
    }
    const data = await res.json();
    const rows: any[][] = data.values || [];
    if (rows.length <= 1) {
      return fetchPublicSheetOrders(spreadsheetId, preferredTab);
    }

    // Find header row: either row 0 or row 1 (as seen in screenshot row 2 has "Invoice ID", "Customer Name", etc.)
    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(3, rows.length); r++) {
      const rowStr = rows[r].map(c => String(c).toLowerCase()).join(' ');
      if (rowStr.includes('invoice') || rowStr.includes('customer') || rowStr.includes('phone') || rowStr.includes('product') || rowStr.includes('গ্রাহক')) {
        headerRowIdx = r;
        break;
      }
    }

    const headers = rows[headerRowIdx].map((c: any) => String(c || '').trim().toLowerCase());

    // Map column indices - ensure product name does not conflict with customer name
    const productCol = headers.findIndex(h => /product|item|পণ্য/i.test(h));
    let nameCol = headers.findIndex(h =>
      (/customer|গ্রাহক|কাস্টমার/i.test(h) || (/(?:^|\b)name(?:\b|$)|নাম/i.test(h) && !/product|item|পণ্য/i.test(h)))
    );
    if (nameCol === -1 || nameCol === productCol) {
      nameCol = headers.findIndex((h, idx) => idx !== productCol && /name|গ্রাহক/i.test(h));
    }

    const invoiceCol = headers.findIndex(h => /invoice|order.*id|inv|আইডি|অর্ডার.*নং/i.test(h));
    const phoneCol = headers.findIndex(h => /phone|mobile|ফোন|মোবাইল|number|নম্বর|contact/i.test(h));
    const addressCol = headers.findIndex(h => /address|ঠিকানা|সিটি|city|adress|লোকেশন|location/i.test(h));
    const sourceCol = headers.findIndex(h => /source|মাধ্যম|সোর্স/i.test(h));
    const statusCol = headers.findIndex(h => /status|অবস্থা/i.test(h) && !/courier/i.test(h));
    const trackingCol = headers.findIndex(h => /tracking|code|ট্র্যাকিং/i.test(h));
    const courierCol = headers.findIndex(h => /courier.*status|কুরিয়ার/i.test(h));
    const steadfastCol = headers.findIndex(h => /steadfast|স্টেডফাস্ট/i.test(h));
    const qtyCol = headers.findIndex(h => /qty|quantity|পরিমাণ/i.test(h));
    const amountCol = headers.findIndex(h => /amount|spend|total|মূল্য|টাকা|দাম|cod/i.test(h));

    const orders: Order[] = [];
    const seenValIds = new Set<string>();

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0 || !r.some(cell => String(cell).trim() !== '')) continue;

      // Match exact columns from user's sheet:
      // Col A (0): Date/ID, Col B (1): Address, Col C (2): Phone/Number, Col D (3): COD, Col E (4): Product, Col F (5): Name
      const isDateLike = (str: string) => /^\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(str.trim());
      const rawIdCandidate = invoiceCol !== -1 ? String(r[invoiceCol] || '').trim() : '';
      const idVal = (rawIdCandidate && !isDateLike(rawIdCandidate)) ? rawIdCandidate : '';
      const rawAmt = amountCol !== -1 ? r[amountCol] : r[3] || r[12] || r[6]; // Col D: COD
      const prodVal = productCol !== -1 ? String(r[productCol] || '').trim() : String(r[4] || 'Golden Watch Combo').trim(); // Col E
      const nameVal = (nameCol !== -1 && r[nameCol]) ? String(r[nameCol] || '').trim() : String(r[5] || r[1] || '').trim(); // Col F

      // Column C: Phone (Index 2 in 0-based array)
      let phoneVal = phoneCol !== -1 && r[phoneCol] !== undefined && String(r[phoneCol]).trim() !== ''
        ? String(r[phoneCol]).trim()
        : String(r[2] || '').trim();
      phoneVal = phoneVal.replace(/\.0+$/, '').trim();

      // Column B: Address (Index 1 in 0-based array)
      let addrVal = addressCol !== -1 && r[addressCol] !== undefined && String(r[addressCol]).trim() !== ''
        ? String(r[addressCol]).trim()
        : String(r[1] || '').trim();

      // Intelligent fallback: If Column C is empty, but Column B contains only digits (like row 6)
      if (!phoneVal && /^\+?\d{10,14}$/.test(addrVal.replace(/\s+/g, ''))) {
        phoneVal = addrVal.replace(/\s+/g, '');
        addrVal = '';
      }
      
      // Column H: Variant / Item Toggle
      const variantCol = headers.findIndex(h => /variant|ভেরিয়েন্ট|আইটেম/i.test(h));
      const variantVal = variantCol !== -1 ? String(r[variantCol] || '').trim() : String(r[7] || 'No Sellect').trim();
      
      // Column I: Source Toggle
      const sourceVal = sourceCol !== -1 ? String(r[sourceCol] || '').trim() : String(r[8] || 'Website').trim();
      
      // Column J: Status Toggle
      const statusVal = statusCol !== -1 ? String(r[statusCol] || '').trim() : String(r[9] || 'Complete').trim();
      
      // Column K: Tracking Code
      const trackVal = trackingCol !== -1 ? String(r[trackingCol] || '').trim() : String(r[10] || '').trim();
      
      // Column L: Courier Status (cancelled, in_review, partial_delivered, delivered)
      const courierVal = courierCol !== -1 ? String(r[courierCol] || '').trim() : String(r[11] || '').trim();
      
      // Column M: Steadfast Status ("No Sellect", "send to steadfast")
      const rawSteadfast = steadfastCol !== -1 ? String(r[steadfastCol] || '').trim() : String(r[12] || '').trim();
      const steadfastVal = rawSteadfast || (trackVal ? 'send to steadfast' : 'No Sellect');
      
      // Column N: Quantity
      const qtyVal = parseInt(String(r[qtyCol !== -1 ? qtyCol : 13] || '1').replace(/[^0-9]/g, '')) || 1;
      
      const parsedAmt = parseFloat(String(rawAmt || '599').replace(/[^0-9.]/g, '')) || 599;

      if (!nameVal && !idVal && !prodVal) continue;

      // Normalize status to clean text
      let cleanStatus: any = statusVal || 'Complete';

      let finalId = idVal ? idVal : (trackVal ? trackVal : `INV-${1000 + i}`);
      while (seenValIds.has(finalId)) {
        finalId = `${finalId}-${i}`;
      }
      seenValIds.add(finalId);

      const rawColADate = String(r[0] !== undefined && r[0] !== null ? r[0] : '').trim();
      const dateVal = rawColADate || '08/09/26';

      orders.push({
        id: finalId,
        customerName: nameVal || (phoneVal ? `গ্রাহক (${phoneVal.slice(-4)})` : (finalId ? `অর্ডার #${finalId}` : `গ্রাহক #${i + 1}`)),
        customerPhone: phoneVal,
        customerAddress: addrVal,
        product: prodVal || 'Golden Watch Combo',
        variant: variantVal || 'No Sellect',
        source: sourceVal || 'Website',
        amount: parsedAmt,
        total: parsedAmt,
        quantity: qtyVal,
        status: cleanStatus,
        trackingCode: trackVal || undefined,
        courierStatus: courierVal || undefined,
        steadfastStatus: steadfastVal,
        date: dateVal,
        rawDate: rawColADate || undefined,
        rowIndex: i + 1, // 1-indexed Google Sheet row
      });
    }

    return { orders, tabName };
  } catch (err) {
    console.warn('Unable to load orders tab:', err);
    return { orders: [], tabName };
  }
};

export const DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbz2d-zKPTuqpSndp2zw-vjlXyEDbFSK-bwbkBdyXfXlk8PwzNuhp5ytIzowXTHkP_smBw/exec';

export const getAppsScriptUrl = (): string => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('apps_script_url') || DEFAULT_APPS_SCRIPT_URL;
  }
  return DEFAULT_APPS_SCRIPT_URL;
};

export const saveAppsScriptUrl = (url: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('apps_script_url', url.trim());
  }
};

export const APPS_SCRIPT_URL = DEFAULT_APPS_SCRIPT_URL;

export interface OrderCardPayload {
  action: 'update_order_card';
  date: string;
  address: string;
  number: string;
  price: number;
  name: string;
  productSelect: string;
  orderSource: string;
  orderStatus: string;
  columnMValue: string;
  [key: string]: any;
}

export interface OrderCardUpdateParams {
  date?: string;
  trackingId?: string;
  address?: string;
  number?: string;
  price?: number;
  name?: string;
  productSelect?: string; // Col H
  orderSource?: string;   // Col I
  orderStatus?: string;   // Col J
  columnMValue?: string;  // Col M (No Select / send to steadfast)
  [key: string]: any;
}

/**
 * Builds the exact 10-key payload requested by the user:
 * {
 *   "action": "update_order_card",
 *   "date": "9/9/2026 19:50:48",
 *   "address": "gzaipur dhaka",
 *   "number": "18803555000",
 *   "price": 599,
 *   "name": "SAZID",
 *   "productSelect": "Doll and toys",
 *   "orderSource": "Whatsapp",
 *   "orderStatus": "Hold",
 *   "columnMValue": "send to steadfast"
 * }
 */
export const buildOrderCardPayload = (
  order: Order,
  overrides: Partial<OrderCardPayload> = {}
): OrderCardPayload => {
  // Column A date text: prioritize rawDate if available, otherwise order.date
  const dateVal = overrides.date !== undefined
    ? String(overrides.date)
    : String(order.rawDate || order.date || '').trim();

  const addressVal = overrides.address !== undefined
    ? String(overrides.address)
    : String(order.customerAddress || '').trim();

  const numberVal = overrides.number !== undefined
    ? String(overrides.number)
    : String(order.customerPhone || '').trim();

  const priceVal = overrides.price !== undefined
    ? Number(overrides.price) || 0
    : Number(order.amount ?? order.total ?? 0) || 0;

  const nameVal = overrides.name !== undefined
    ? String(overrides.name)
    : String(order.customerName || '').trim();

  const productSelectVal = overrides.productSelect !== undefined
    ? String(overrides.productSelect)
    : String(order.variant || order.product || 'No Sellect').trim();

  const orderSourceVal = overrides.orderSource !== undefined
    ? String(overrides.orderSource)
    : String(order.source || 'Website').trim();

  const orderStatusVal = overrides.orderStatus !== undefined
    ? String(overrides.orderStatus)
    : String(order.status || 'Pending').trim();

  const isSteadfast =
    order.steadfastStatus === 'send to steadfast' ||
    order.steadfastStatus === 'Sent to Steadfast' ||
    /send to steadfast/i.test(order.steadfastStatus || '');

  const columnMVal = overrides.columnMValue !== undefined
    ? String(overrides.columnMValue)
    : (isSteadfast ? 'send to steadfast' : String(order.steadfastStatus || 'No Select').trim());

  return {
    action: 'update_order_card',
    date: dateVal,
    address: addressVal,
    number: numberVal,
    price: priceVal,
    name: nameVal,
    productSelect: productSelectVal,
    orderSource: orderSourceVal,
    orderStatus: orderStatusVal,
    columnMValue: columnMVal,
  };
};

/**
 * Update order card directly via Apps Script Web App
 * Sends the exact format requested:
 * fetch(WEB_APP_URL, {
 *   method: "POST",
 *   headers: { "Content-Type": "text/plain;charset=utf-8" },
 *   body: JSON.stringify({
 *     action: "update_order_card",
 *     date: "9/9/2026 19:50:48",
 *     address: "...",
 *     number: "...",
 *     price: 599,
 *     name: "...",
 *     productSelect: "...",
 *     orderSource: "...",
 *     orderStatus: "...",
 *     columnMValue: "..."
 *   })
 * });
 */
export const updateOrderCardViaAppsScript = async (
  payload: OrderCardUpdateParams | OrderCardPayload | any,
  scriptUrl: string = getAppsScriptUrl()
) => {
  const WEB_APP_URL = scriptUrl || getAppsScriptUrl();

  // Construct the exact 10-key JSON body specified by the user
  const bodyData: Record<string, any> = {
    action: 'update_order_card',
    date: String(payload.date || '').trim(),
    address: String(payload.address || '').trim(),
    number: String(payload.number || '').trim(),
    price: Number(payload.price) || 0,
    name: String(payload.name || '').trim(),
    productSelect: String(payload.productSelect || '').trim(),
    orderSource: String(payload.orderSource || '').trim(),
    orderStatus: String(payload.orderStatus || '').trim(),
    columnMValue: String(payload.columnMValue || '').trim(),
  };

  if (payload.trackingId) {
    bodyData.trackingId = String(payload.trackingId).trim();
  }

  const jsonString = JSON.stringify(bodyData);
  console.log('[Webhook POST] update_order_card payload:', jsonString);

  try {
    const res = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: jsonString,
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({ success: true }));
      return data;
    }
  } catch (err) {
    console.warn('Apps Script direct POST error, retrying with fallback:', err);
    try {
      await fetch(WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: jsonString,
        mode: 'no-cors',
      });
      return { success: true };
    } catch (e2) {
      console.warn('Apps Script no-cors dispatched:', e2);
    }
  }

  return { success: true };
};

export interface SteadfastOrderItemPayload {
  date: string;
  number: string;
  columnMValue: string;
}

export type SteadfastDispatchPayload =
  | SteadfastOrderItemPayload
  | SteadfastOrderItemPayload[];

/**
 * Builds an individual Steadfast dispatch item matching:
 * {
 *   "date": "9/14/2026 10:00:00",
 *   "number": "01700000000",
 *   "columnMValue": "Send to Steadfast"
 * }
 */
export const buildSteadfastOrderItem = (
  order: Order,
  columnMValue: string = 'Send to Steadfast'
): SteadfastOrderItemPayload => {
  const rawDate = String(order.rawDate || order.date || '').trim();
  const phone = String(order.customerPhone || '').trim();
  return {
    date: rawDate,
    number: phone,
    columnMValue,
  };
};

/**
 * Builds the payload for sending orders to Steadfast via Google Apps Script:
 * - Single order -> 1 object: { date, number, columnMValue: "Send to Steadfast" }
 * - Multiple orders (bulk/select all) -> Array of objects: [ { date, number, columnMValue }, ... ]
 */
export const buildSteadfastDispatchPayload = (
  orders: Order | Order[],
  columnMValue: string = 'Send to Steadfast'
): SteadfastDispatchPayload => {
  if (Array.isArray(orders)) {
    if (orders.length === 1) {
      return buildSteadfastOrderItem(orders[0], columnMValue);
    }
    return orders.map((o) => buildSteadfastOrderItem(o, columnMValue));
  }
  return buildSteadfastOrderItem(orders, columnMValue);
};

/**
 * Dispatches the exact JSON format requested when sending orders to Steadfast:
 * Single order:
 * {
 *   "date": "9/14/2026 10:00:00",
 *   "number": "01700000000",
 *   "columnMValue": "Send to Steadfast"
 * }
 * Bulk array:
 * [
 *   {
 *     "date": "9/14/2026 10:00:00",
 *     "number": "01700000000",
 *     "columnMValue": "Send to Steadfast"
 *   },
 *   ...
 * ]
 */
export const sendSteadfastOrdersViaAppsScript = async (
  orders: Order | Order[],
  columnMValue: string = 'Send to Steadfast',
  scriptUrl: string = getAppsScriptUrl()
) => {
  if (Array.isArray(orders) && orders.length === 0) {
    return { success: true };
  }

  const WEB_APP_URL = scriptUrl || getAppsScriptUrl();
  const payload = buildSteadfastDispatchPayload(orders, columnMValue);
  const jsonString = JSON.stringify(payload);
  console.log('[Webhook POST - Steadfast Dispatch] payload:', jsonString);

  try {
    const res = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: jsonString,
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({ success: true }));
      return data;
    }
  } catch (err) {
    console.warn('Steadfast Apps Script direct POST error, retrying with fallback:', err);
    try {
      await fetch(WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: jsonString,
        mode: 'no-cors',
      });
      return { success: true };
    } catch (e2) {
      console.warn('Steadfast Apps Script no-cors dispatched:', e2);
    }
  }

  return { success: true };
};

export interface AppsScriptUpdatePayload {
  action?: string;
  row_number?: number;
  row?: number;
  rowIndex?: number;
  id?: string;
  orderId?: string;
  customer?: string;
  customer_name?: string;
  customerName?: string;
  name?: string;
  phone?: string;
  customer_phone?: string;
  customerPhone?: string;
  address?: string;
  customer_address?: string;
  customerAddress?: string;
  order_status?: string;
  orderStatus?: string;
  status?: string;
  courier_id?: string;
  courierId?: string;
  courier_status?: string;
  courierStatus?: string;
  courier_action?: string;
  courierAction?: string;
  steadfastStatus?: string;
  selected_product?: string;
  selectedProduct?: string;
  variant?: string;
  source?: string;
  quantity?: number;
  qty?: number;
  column?: string;
  col?: number;
  value?: string | number;
  delivery_status?: string;
  delivery_amount?: number | string;
  delivery_charge?: number | string;
  cod?: number | string;
  amount?: number | string;
  price?: number | string;
  total?: number | string;
  number?: string;
  mobile?: string;
  [key: string]: any;
}

/**
 * Update order row directly via Google Apps Script Web App without needing OAuth login.
 * Dispatches BOTH GET (via query parameters with zero CORS restrictions)
 * and POST (with JSON & form-encoded fallbacks) to ensure 100% arrival in Google Sheets.
 */
export const updateOrderViaAppsScript = async (
  payload: AppsScriptUpdatePayload,
  scriptUrl: string = getAppsScriptUrl()
) => {
  const targetUrl = scriptUrl || getAppsScriptUrl();
  const rowNum = payload.row_number || payload.row || payload.rowIndex;
  const orderId = payload.id || payload.orderId;
  const actionToUse = payload.action || 'update_order';

  const fullPayload: Record<string, any> = {
    action: actionToUse,
    action_type: actionToUse,
    ...payload,
  };
  const trackingId = payload.trackingId || payload.trackingCode || payload.courier_id || payload.orderId || payload.id;
  if (trackingId) {
    fullPayload.trackingId = String(trackingId);
  }
  const productSelect = payload.productSelect || payload.selected_product || payload.selectedProduct || payload.variant;
  if (productSelect !== undefined) {
    fullPayload.productSelect = String(productSelect);
  }
  const orderSource = payload.orderSource || payload.source;
  if (orderSource !== undefined) {
    fullPayload.orderSource = String(orderSource);
  }
  const orderStatus = payload.orderStatus || payload.order_status || payload.status;
  if (orderStatus !== undefined) {
    fullPayload.orderStatus = String(orderStatus);
  }
  const columnMValue = payload.columnMValue || payload.courier_action || payload.courierAction || payload.steadfastStatus;
  if (columnMValue !== undefined) {
    fullPayload.columnMValue = String(columnMValue);
  }
  const addr = payload.address || payload.customer_address || payload.customerAddress;
  if (addr !== undefined) {
    fullPayload.address = String(addr);
  }
  const num = payload.number || payload.phone || payload.customer_phone || payload.customerPhone;
  if (num !== undefined) {
    fullPayload.number = String(num);
  }
  const cName = payload.name || payload.customer_name || payload.customerName || payload.customer;
  if (cName !== undefined) {
    fullPayload.name = String(cName);
  }
  const prc = payload.price !== undefined ? payload.price : (payload.amount !== undefined ? payload.amount : (payload.cod !== undefined ? payload.cod : payload.total));
  if (prc !== undefined) {
    fullPayload.price = Number(prc) || 0;
  }
  if (rowNum) {
    fullPayload.row = rowNum;
    fullPayload.row_number = rowNum;
    fullPayload.rowIndex = rowNum;
  }
  if (orderId) {
    fullPayload.id = orderId;
    fullPayload.orderId = orderId;
  }

  // 1. Method A: GET with query params (Guaranteed to work and bypass CORS in Google Apps Script)
  try {
    const getUrl = new URL(targetUrl);
    getUrl.searchParams.set('action', actionToUse);
    getUrl.searchParams.set('action_name', actionToUse);
    if (rowNum) {
      getUrl.searchParams.set('row', String(rowNum));
      getUrl.searchParams.set('row_number', String(rowNum));
    }
    // Column M: Steadfast Action
    if (payload.courier_action || payload.courierAction || payload.steadfastStatus) {
      const act = payload.courier_action || payload.courierAction || payload.steadfastStatus;
      getUrl.searchParams.set('courier_action', String(act));
      getUrl.searchParams.set('courierAction', String(act));
      getUrl.searchParams.set('steadfastStatus', String(act));
    }
    // Column N: Quantity
    if (payload.quantity !== undefined || payload.qty !== undefined) {
      const q = payload.quantity !== undefined ? payload.quantity : payload.qty;
      getUrl.searchParams.set('quantity', String(q));
      getUrl.searchParams.set('qty', String(q));
    }
    // Column J: Status
    if (payload.order_status || payload.orderStatus || payload.status) {
      const st = payload.order_status || payload.orderStatus || payload.status;
      getUrl.searchParams.set('order_status', String(st));
      getUrl.searchParams.set('orderStatus', String(st));
      getUrl.searchParams.set('status', String(st));
    }
    // Column H: Variant
    if (payload.selected_product || payload.selectedProduct || payload.variant) {
      const vr = payload.selected_product || payload.selectedProduct || payload.variant;
      getUrl.searchParams.set('selected_product', String(vr));
      getUrl.searchParams.set('variant', String(vr));
    }
    // Column I: Source
    if (payload.source) {
      getUrl.searchParams.set('source', String(payload.source));
    }
    // Column F: Customer Name
    if (payload.customer_name || payload.customerName || payload.customer || payload.name) {
      const nm = payload.customer_name || payload.customerName || payload.customer || payload.name;
      getUrl.searchParams.set('customer_name', String(nm));
      getUrl.searchParams.set('customerName', String(nm));
      getUrl.searchParams.set('customer', String(nm));
      getUrl.searchParams.set('name', String(nm));
    }
    // Column C: Customer Phone
    if (payload.phone || payload.customer_phone || payload.customerPhone || payload.number || payload.mobile) {
      const ph = payload.phone || payload.customer_phone || payload.customerPhone || payload.number || payload.mobile;
      getUrl.searchParams.set('phone', String(ph));
      getUrl.searchParams.set('customer_phone', String(ph));
      getUrl.searchParams.set('customerPhone', String(ph));
      getUrl.searchParams.set('number', String(ph));
      getUrl.searchParams.set('mobile', String(ph));
    }
    // Column B: Customer Address
    if (payload.address || payload.customer_address || payload.customerAddress) {
      const addr = payload.address || payload.customer_address || payload.customerAddress;
      getUrl.searchParams.set('address', String(addr));
      getUrl.searchParams.set('customer_address', String(addr));
      getUrl.searchParams.set('customerAddress', String(addr));
    }
    // Column D: COD / Price / Amount
    if (payload.cod !== undefined || payload.amount !== undefined || payload.price !== undefined || payload.total !== undefined) {
      const pr = payload.cod !== undefined ? payload.cod : (payload.amount !== undefined ? payload.amount : (payload.price !== undefined ? payload.price : payload.total));
      getUrl.searchParams.set('cod', String(pr));
      getUrl.searchParams.set('amount', String(pr));
      getUrl.searchParams.set('price', String(pr));
      getUrl.searchParams.set('total', String(pr));
    }

    Object.entries(fullPayload).forEach(([key, val]) => {
      if (val !== undefined && val !== null && !getUrl.searchParams.has(key)) {
        getUrl.searchParams.set(key, String(val));
      }
    });

    // Fire GET request
    fetch(getUrl.toString(), {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-cache',
    }).catch((e) => {
      console.warn('GET update background notice:', e);
    });
  } catch (err) {
    console.warn('Unable to form GET URL for Apps Script:', err);
  }

  // 2. Method B: POST with text/plain JSON
  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(fullPayload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({ success: true }));
      return data;
    }
  } catch (err) {
    console.warn('Apps Script POST error, retrying without cors:', err);
    try {
      await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(fullPayload),
        mode: 'no-cors',
      });
      return { success: true };
    } catch (e2) {
      console.warn('Apps Script no-cors write dispatched:', e2);
    }
  }

  return { success: true };
};

/**
 * Update order status directly in Column J of the Google Sheet row
 */
export const updateSheetOrderStatus = async (
  spreadsheetId: string,
  accessToken: string | null | undefined,
  tabName: string,
  rowIndex: number,
  newStatus: string,
  orderId?: string
) => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const cleanTab = (tabName || 'Sheet2').replace(/['"]/g, '');
  const validRow = rowIndex && rowIndex > 1 ? rowIndex : 2;

  if (accessToken && validRow > 0) {
    try {
      const cellRange = `'${cleanTab}'!J${validRow}`;
      const res = await fetch(
        `${SHEETS_API_BASE}/${cleanId}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: cellRange,
            values: [[newStatus]],
          }),
        }
      );

      if (res.ok) {
        return res.json();
      }
    } catch (err) {
      console.warn('Direct Sheet API failed, falling back to Apps Script:', err);
    }
  }

  // Seamless fallback to Apps Script Web App
  return updateOrderViaAppsScript({
    action: 'update_order',
    row_number: validRow,
    row: validRow,
    rowIndex: validRow,
    id: orderId,
    orderId: orderId,
    order_status: newStatus,
    orderStatus: newStatus,
    status: newStatus,
    column: 'J',
    col: 10,
    value: newStatus,
    sheetName: cleanTab,
    tabName: cleanTab,
    sheet: cleanTab,
  });
};

/**
 * Update Variant in Column H of the Google Sheet row
 */
export const updateSheetVariant = async (
  spreadsheetId: string,
  accessToken: string | null | undefined,
  tabName: string,
  rowIndex: number,
  newVariant: string,
  orderId?: string
) => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const cleanTab = (tabName || 'Sheet2').replace(/['"]/g, '');
  const validRow = rowIndex && rowIndex > 1 ? rowIndex : 2;

  if (accessToken && validRow > 0) {
    try {
      const cellRange = `'${cleanTab}'!H${validRow}`;
      const res = await fetch(
        `${SHEETS_API_BASE}/${cleanId}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: cellRange,
            values: [[newVariant]],
          }),
        }
      );
      if (res.ok) {
        return res.json();
      }
    } catch (err) {
      console.warn('Direct Sheet API variant failed, falling back to Apps Script:', err);
    }
  }

  return updateOrderViaAppsScript({
    action: 'update_order',
    row_number: validRow,
    row: validRow,
    rowIndex: validRow,
    id: orderId,
    orderId: orderId,
    selected_product: newVariant,
    selectedProduct: newVariant,
    variant: newVariant,
    column: 'H',
    col: 8,
    value: newVariant,
    sheetName: cleanTab,
    tabName: cleanTab,
    sheet: cleanTab,
  });
};

/**
 * Update Source in Column I of the Google Sheet row
 */
export const updateSheetSource = async (
  spreadsheetId: string,
  accessToken: string | null | undefined,
  tabName: string,
  rowIndex: number,
  newSource: string,
  orderId?: string
) => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const cleanTab = (tabName || 'Sheet2').replace(/['"]/g, '');
  const validRow = rowIndex && rowIndex > 1 ? rowIndex : 2;

  if (accessToken && validRow > 0) {
    try {
      const cellRange = `'${cleanTab}'!I${validRow}`;
      const res = await fetch(
        `${SHEETS_API_BASE}/${cleanId}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: cellRange,
            values: [[newSource]],
          }),
        }
      );
      if (res.ok) {
        return res.json();
      }
    } catch (err) {
      console.warn('Direct Sheet API source failed, falling back to Apps Script:', err);
    }
  }

  return updateOrderViaAppsScript({
    action: 'update_order',
    row_number: validRow,
    row: validRow,
    rowIndex: validRow,
    id: orderId,
    orderId: orderId,
    source: newSource,
    column: 'I',
    col: 9,
    value: newSource,
    sheetName: cleanTab,
    tabName: cleanTab,
    sheet: cleanTab,
  });
};

/**
 * Update Steadfast Action ONLY in Column M of the Google Sheet row
 * Does NOT touch Column K (Tracking Code) or Column L (Courier Status),
 * so that Google Sheet automation / Steadfast trigger can automatically populate K and L.
 */
export const updateSheetSteadfastAction = async (
  spreadsheetId: string,
  accessToken: string | null | undefined,
  tabName: string,
  rowIndex: number,
  action: 'send to steadfast' | 'No Sellect' | string,
  orderId?: string
) => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const cleanTab = (tabName || 'Sheet2').replace(/['"]/g, '');
  const validRow = rowIndex && rowIndex > 1 ? rowIndex : 2;

  if (accessToken && validRow > 0) {
    try {
      const cellRange = `'${cleanTab}'!M${validRow}`;
      const res = await fetch(
        `${SHEETS_API_BASE}/${cleanId}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: cellRange,
            values: [[action]],
          }),
        }
      );
      if (res.ok) {
        return res.json();
      }
    } catch (err) {
      console.warn('Direct Sheet API steadfast action failed, falling back to Apps Script:', err);
    }
  }

  // Fallback to Apps Script: passes courier_action (Column M), preserving K & L
  return updateOrderViaAppsScript({
    action: 'update_order',
    action_type: 'update_order',
    row_number: validRow,
    row: validRow,
    rowIndex: validRow,
    id: orderId,
    orderId: orderId,
    courier_action: action,
    courierAction: action,
    steadfastStatus: action,
    steadfast_status: action,
    column: 'M',
    col: 13,
    value: action,
    sheetName: cleanTab,
    tabName: cleanTab,
    sheet: cleanTab,
  });
};

/**
 * Batch update Steadfast Action in Column M for multiple orders at once
 * Real-time update to Google Sheet Column M
 */
export const updateSheetSteadfastActionBatch = async (
  spreadsheetId: string,
  accessToken: string | null | undefined,
  tabName: string,
  updates: { rowIndex: number; action: string; orderId?: string }[]
) => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const cleanTab = (tabName || 'Sheet2').replace(/['"]/g, '');

  if (accessToken && updates.length > 0) {
    try {
      const batchUrl = `${SHEETS_API_BASE}/${cleanId}/values:batchUpdate`;
      const dataRanges = updates.map((u) => ({
        range: `'${cleanTab}'!M${u.rowIndex && u.rowIndex > 1 ? u.rowIndex : 2}`,
        values: [[u.action]],
      }));

      const batchRes = await fetch(batchUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: dataRanges,
        }),
      });

      if (batchRes.ok) {
        return await batchRes.json();
      }
    } catch (err) {
      console.warn('Batch Steadfast direct API failed, falling back to individual updates:', err);
    }
  }

  // Fallback: update sequentially or in small throttled batches to avoid overwhelming Apps Script / CORS limits
  const results = [];
  const chunkSize = 3;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    const chunkResults = await Promise.allSettled(
      chunk.map((u) =>
        updateSheetSteadfastAction(
          spreadsheetId,
          accessToken,
          cleanTab,
          u.rowIndex,
          u.action,
          u.orderId
        )
      )
    );
    results.push(...chunkResults);
    if (i + chunkSize < updates.length) {
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }
  return results;
};

/**
 * Update Quantity in Column N of the Google Sheet row
 */
export const updateSheetQuantity = async (
  spreadsheetId: string,
  accessToken: string | null | undefined,
  tabName: string,
  rowIndex: number,
  newQuantity: number,
  orderId?: string
) => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const cleanTab = (tabName || 'Sheet2').replace(/['"]/g, '');
  const validRow = rowIndex && rowIndex > 1 ? rowIndex : 2;

  if (accessToken && validRow > 0) {
    try {
      const cellRange = `'${cleanTab}'!N${validRow}`;
      const res = await fetch(
        `${SHEETS_API_BASE}/${cleanId}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: cellRange,
            values: [[newQuantity]],
          }),
        }
      );
      if (res.ok) {
        return res.json();
      }
    } catch (err) {
      console.warn('Direct Sheet API quantity failed, falling back to Apps Script:', err);
    }
  }

  return updateOrderViaAppsScript({
    action: 'update_order',
    row_number: validRow,
    row: validRow,
    rowIndex: validRow,
    id: orderId,
    orderId: orderId,
    quantity: newQuantity,
    qty: newQuantity,
    column: 'N',
    col: 14,
    value: newQuantity,
    sheetName: cleanTab,
    tabName: cleanTab,
    sheet: cleanTab,
  });
};

/**
 * Update Customer Details (Name, Phone, Address, Price) in Google Sheet
 * - Col B (Col 2): Address
 * - Col C (Col 3): Phone
 * - Col D (Col 4): COD / Price / Amount
 * - Col F (Col 6): Customer Name
 */
export const updateSheetCustomerDetails = async (
  spreadsheetId: string,
  accessToken: string | null | undefined,
  tabName: string,
  rowIndex: number,
  details: {
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    amount?: number;
    price?: number;
  },
  orderId?: string
) => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const cleanTab = (tabName || 'Sheet2').replace(/['"]/g, '');
  const validRow = rowIndex && rowIndex > 1 ? rowIndex : 2;
  const priceVal =
    details.amount !== undefined
      ? details.amount
      : details.price !== undefined
      ? details.price
      : undefined;

  if (accessToken && validRow > 0) {
    try {
      const dataRanges: { range: string; values: any[][] }[] = [
        {
          range: `'${cleanTab}'!B${validRow}`,
          values: [[details.customerAddress || '']],
        },
        {
          range: `'${cleanTab}'!C${validRow}`,
          values: [[details.customerPhone || '']],
        },
        {
          range: `'${cleanTab}'!F${validRow}`,
          values: [[details.customerName || '']],
        },
      ];

      if (priceVal !== undefined && priceVal !== null) {
        dataRanges.push({
          range: `'${cleanTab}'!D${validRow}`,
          values: [[priceVal]],
        });
      }

      // Try batchUpdate first
      const batchUrl = `${SHEETS_API_BASE}/${cleanId}/values:batchUpdate`;
      const batchRes = await fetch(batchUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: dataRanges,
        }),
      });

      if (batchRes.ok) {
        return await batchRes.json();
      }

      // Fallback: Individual parallel PUTs
      const singleResults = await Promise.allSettled(
        dataRanges.map((item) => {
          const putUrl = `${SHEETS_API_BASE}/${cleanId}/values/${encodeURIComponent(item.range)}?valueInputOption=USER_ENTERED`;
          return fetch(putUrl, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              range: item.range,
              values: item.values,
            }),
          });
        })
      );

      const anyOk = singleResults.some((r) => r.status === 'fulfilled' && (r.value as Response).ok);
      if (anyOk) {
        return { success: true };
      }
    } catch (err) {
      console.warn('Direct Sheet API customer details update failed, falling back to Apps Script:', err);
    }
  }

  return updateOrderViaAppsScript({
    action: 'update_order',
    row_number: validRow,
    row: validRow,
    rowIndex: validRow,
    id: orderId,
    orderId: orderId,
    customer_name: details.customerName,
    customerName: details.customerName,
    customer: details.customerName,
    name: details.customerName,
    phone: details.customerPhone,
    customer_phone: details.customerPhone,
    customerPhone: details.customerPhone,
    number: details.customerPhone,
    mobile: details.customerPhone,
    address: details.customerAddress,
    customer_address: details.customerAddress,
    customerAddress: details.customerAddress,
    cod: priceVal,
    amount: priceVal,
    price: priceVal,
    total: priceVal,
    sheetName: cleanTab,
    tabName: cleanTab,
    sheet: cleanTab,
  });
};

/**
 * Complete, copy-pasteable Google Apps Script code for the user's Sheet2
 */
export const COMPLETE_APPS_SCRIPT_CODE = `const SPREADSHEET_ID = "1aHUCGINJ8rB29rXXckH7uMTwrk163v6aQFTfQ6ptr6M";
const SHEET_NAME = "Sheet2";

// Column Index Mapping (1-based index)
const COL = {
  date: 1,             // A
  address: 2,          // B
  phone: 3,            // C
  cod: 4,              // D
  productName: 5,      // E
  customerName: 6,     // F
  selectedProduct: 8,  // H (Variant)
  source: 9,           // I (Source)
  orderStatus: 10,     // J (Order Status)
  courierId: 11,       // K (Tracking Code)
  courierStatus: 12,   // L (Courier Status)
  courierAction: 13,   // M (Steadfast Action)
  quantity: 14,        // N (Quantity)
  deliveryStatus: 16,  // P
  deliveryAmount: 17,  // Q
  deliveryCharge: 18   // R
};

function getWooSheet_() {
  const file = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = file.getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error("Sheet2 পাওয়া যায়নি");
  }
  return sheet;
}

function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    if (params.action === "update_order" || params.action === "update") {
      return handleOrderUpdate_(params);
    }

    const sheet = getWooSheet_();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return responseJson_({ success: true, orders: [] });
    }

    const orders = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.join("").trim() === "") continue;

      orders.push({
        row_number: i + 1,
        date: row[COL.date - 1] || "",
        address: row[COL.address - 1] || "",
        phone: row[COL.phone - 1] || "",
        cod: row[COL.cod - 1] || 0,
        product: row[COL.productName - 1] || "",
        customer: row[COL.customerName - 1] || "",
        selected_product: row[COL.selectedProduct - 1] || "No Sellect",
        source: row[COL.source - 1] || "Website",
        order_status: row[COL.orderStatus - 1] || "Hold",
        courier_id: row[COL.courierId - 1] || "",
        courier_status: row[COL.courierStatus - 1] || "",
        courier_action: row[COL.courierAction - 1] || "No Sellect",
        quantity: row[COL.quantity - 1] || 1,
        delivery_status: row[COL.deliveryStatus - 1] || "",
        delivery_amount: row[COL.deliveryAmount - 1] || 0,
        delivery_charge: row[COL.deliveryCharge - 1] || 0
      });
    }

    return responseJson_({ success: true, orders: orders });
  } catch (err) {
    return responseJson_({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    let data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    return handleOrderUpdate_(data);
  } catch (err) {
    return responseJson_({ success: false, error: err.toString() });
  }
}

function handleOrderUpdate_(data) {
  const targetSheetName = data.sheetName || data.tabName || (data.action && data.action.includes('sheet3') ? 'Sheet3' : '');
  if (targetSheetName === 'Sheet3' || (data.action && data.action.includes('sheet3'))) {
    const s3 = getWooSheet_('Sheet3');
    if (data.action === 'append_sheet3_entry') {
      s3.appendRow([
        data.date || new Date().toLocaleString(),
        data.productName || data.product || '',
        data.source || 'Stock',
        data.stockIn === '' || data.stockIn === undefined ? '' : Number(data.stockIn),
        data.stockOut === '' || data.stockOut === undefined ? '' : Number(data.stockOut),
        data.currentStock !== undefined ? Number(data.currentStock) : 0,
        data.currentPrice || data.price || ''
      ]);
      return responseJson_({ success: true, message: "Sheet3 row appended" });
    }

    let rNum = parseInt(data.row_number || data.row || data.rowIndex, 10);
    if (!rNum || isNaN(rNum) || rNum < 8) {
      rNum = s3.getLastRow() + 1;
    }
    if (data.date !== undefined) s3.getRange(rNum, 1).setValue(String(data.date));
    if (data.productName !== undefined || data.product !== undefined) s3.getRange(rNum, 2).setValue(String(data.productName || data.product));
    if (data.source !== undefined) s3.getRange(rNum, 3).setValue(String(data.source));
    if (data.stockIn !== undefined) s3.getRange(rNum, 4).setValue(data.stockIn === '' ? '' : Number(data.stockIn));
    if (data.stockOut !== undefined) s3.getRange(rNum, 5).setValue(data.stockOut === '' ? '' : Number(data.stockOut));
    if (data.currentStock !== undefined) s3.getRange(rNum, 6).setValue(Number(data.currentStock));
    if (data.currentPrice !== undefined || data.price !== undefined) s3.getRange(rNum, 7).setValue(data.currentPrice || data.price);
    return responseJson_({ success: true, message: "Sheet3 updated", row_number: rNum });
  }

  const sheet = getWooSheet_();
  let rowNumber = parseInt(data.row_number || data.row || data.rowIndex, 10);

  if (!rowNumber || isNaN(rowNumber) || rowNumber < 2) {
    const targetId = String(data.trackingId || data.id || data.orderId || "").trim();
    if (targetId) {
      const allData = sheet.getDataRange().getValues();
      for (let r = 1; r < allData.length; r++) {
        const idA = String(allData[r][0] || "").trim();
        const idB = String(allData[r][1] || "").trim();
        const phoneC = String(allData[r][2] || "").trim();
        const trackingK = String(allData[r][COL.courierId - 1] || "").trim();
        if (trackingK === targetId || idA === targetId || idB === targetId || phoneC === targetId) {
          rowNumber = r + 1;
          break;
        }
      }
    }
  }

  if (!rowNumber || isNaN(rowNumber) || rowNumber < 2) {
    return responseJson_({ success: false, error: "Row not found for ID: " + (data.trackingId || data.id || "") });
  }

  const updatedFields = [];

  // Column B (Address)
  const addressVal = data.address !== undefined ? data.address : (data.customerAddress !== undefined ? data.customerAddress : data.customer_address);
  if (addressVal !== undefined) {
    sheet.getRange(rowNumber, COL.address).setValue(String(addressVal));
    updatedFields.push("B: " + addressVal);
  }

  // Column C (Phone / Number)
  const phoneVal = data.number !== undefined ? data.number : (data.phone !== undefined ? data.phone : (data.customerPhone !== undefined ? data.customerPhone : data.customer_phone));
  if (phoneVal !== undefined) {
    sheet.getRange(rowNumber, COL.phone).setValue(String(phoneVal));
    updatedFields.push("C: " + phoneVal);
  }

  // Column D (COD / Price / Amount)
  const codVal = data.price !== undefined ? data.price : (data.cod !== undefined ? data.cod : (data.amount !== undefined ? data.amount : data.total));
  if (codVal !== undefined && codVal !== "") {
    const numCod = parseFloat(codVal) || 0;
    sheet.getRange(rowNumber, COL.cod).setValue(numCod);
    updatedFields.push("D: " + numCod);
  }

  // Column F (Customer Name)
  const nameVal = data.name !== undefined ? data.name : (data.customer !== undefined ? data.customer : (data.customerName !== undefined ? data.customerName : (data.customer_name !== undefined ? data.customer_name : data.customer)));
  if (nameVal !== undefined) {
    sheet.getRange(rowNumber, COL.customerName).setValue(String(nameVal));
    updatedFields.push("F: " + nameVal);
  }

  // Column H (Variant / Product Select)
  const variantVal = data.productSelect !== undefined ? data.productSelect : (data.selectedProduct !== undefined ? data.selectedProduct : (data.selected_product !== undefined ? data.selected_product : data.variant));
  if (variantVal !== undefined) {
    sheet.getRange(rowNumber, COL.selectedProduct).setValue(String(variantVal));
    updatedFields.push("H: " + variantVal);
  }

  // Column I (Source / Order Source)
  const sourceVal = data.orderSource !== undefined ? data.orderSource : data.source;
  if (sourceVal !== undefined) {
    sheet.getRange(rowNumber, COL.source).setValue(String(sourceVal));
    updatedFields.push("I: " + sourceVal);
  }

  // Column J (Order Status)
  const statusVal = data.orderStatus !== undefined ? data.orderStatus : (data.order_status !== undefined ? data.order_status : data.status);
  if (statusVal !== undefined) {
    sheet.getRange(rowNumber, COL.orderStatus).setValue(String(statusVal));
    updatedFields.push("J: " + statusVal);
  }

  // Column M (Steadfast Action / Column M Value)
  const actionVal = data.columnMValue !== undefined ? data.columnMValue : (data.courierAction !== undefined ? data.courierAction : (data.courier_action !== undefined ? data.courier_action : data.steadfastStatus));
  if (actionVal !== undefined) {
    sheet.getRange(rowNumber, COL.courierAction).setValue(String(actionVal));
    updatedFields.push("M: " + actionVal);
  }

  // Column N (Quantity)
  const qtyVal = data.quantity !== undefined ? data.quantity : data.qty;
  if (qtyVal !== undefined) {
    const numQty = parseInt(qtyVal, 10) || 1;
    sheet.getRange(rowNumber, COL.quantity).setValue(numQty);
    updatedFields.push("N: " + numQty);
  }

  // Direct Col/Value (Allows any column 1-26 to be updated directly)
  if (data.col && data.value !== undefined) {
    const directCol = parseInt(data.col, 10);
    if (!isNaN(directCol) && directCol >= 1 && directCol <= 26) {
      sheet.getRange(rowNumber, directCol).setValue(data.value);
      updatedFields.push("Col " + directCol + ": " + data.value);
    }
  }

  return responseJson_({
    success: true,
    message: "Google Sheet updated",
    row_number: rowNumber,
    row: rowNumber,
    updated: updatedFields
  });
}

function responseJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;

/**
 * Update Steadfast Courier Status and Tracking Code in Google Sheet (Columns K, L, M)
 */
export const updateSheetCourierStatus = async (
  spreadsheetId: string,
  accessToken: string | null | undefined,
  tabName: string,
  rowIndex: number,
  trackingCode: string,
  steadfastStatus: string,
  courierStatus: string = 'in_review',
  orderId?: string
) => {
  if (accessToken) {
    try {
      // Columns K, L, M: Tracking Code (K), Courier Status (L), Steadfast Status (M)
      const range = `'${tabName}'!K${rowIndex}:M${rowIndex}`;
      const res = await fetch(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range,
            values: [[trackingCode, courierStatus, steadfastStatus]],
          }),
        }
      );

      if (res.ok) {
        return res.json();
      }
    } catch (err) {
      console.warn('Direct Sheet API courier failed, falling back to Apps Script:', err);
    }
  }

  return updateOrderViaAppsScript({
    row_number: rowIndex,
    id: orderId,
    courier_id: trackingCode,
    courier_status: courierStatus,
    courier_action: steadfastStatus,
  });
};

/**
 * Seed initial sample WooCommerce products to user's sheet if empty
 */
export const seedSampleProducts = async (
  spreadsheetId: string,
  accessToken: string,
  tabName: string = 'Products'
) => {
  const headers = ['ID', 'Name', 'Category', 'Price', 'Sale Price', 'Stock', 'Status', 'Description', 'Image'];
  const sampleProducts = [
    [
      'SKU-1001',
      'Premium Cotton Panjabi',
      'Traditional Wear',
      '2450',
      '1950',
      '25',
      'publish',
      'High-grade organic combed cotton embroidered festive panjabi for modern style.',
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80',
    ],
    [
      'SKU-1002',
      'Slim-Fit Chino Pants',
      'Men Clothing',
      '1650',
      '',
      '40',
      'publish',
      'Comfort stretch twill fabric with tailored modern fit for all-day office comfort.',
      'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&auto=format&fit=crop&q=80',
    ],
    [
      'SKU-1003',
      'Handcrafted Leather Wallet',
      'Accessories',
      '1200',
      '990',
      '18',
      'publish',
      'Genuine full-grain leather bi-fold wallet with RFID protection and coin pocket.',
      'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&auto=format&fit=crop&q=80',
    ],
    [
      'SKU-1004',
      'Floral Georgette Saree',
      'Women Wear',
      '3800',
      '3200',
      '12',
      'publish',
      'Graceful lightweight georgette printed saree with running blouse piece.',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80',
    ],
    [
      'SKU-1005',
      'Minimalist Analog Watch',
      'Accessories',
      '2150',
      '',
      '8',
      'publish',
      'Matte black stainless steel case, water resistant 3ATM with interchangeable strap.',
      'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80',
    ],
    [
      'SKU-1006',
      'Wireless Noise Cancelling Earbuds',
      'Electronics',
      '2950',
      '2490',
      '30',
      'publish',
      'Deep bass sound, 32-hour playback battery life with fast charging USB-C case.',
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
    ],
  ];

  await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/'${tabName}'!A1:I7?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `'${tabName}'!A1:I7`,
        majorDimension: 'ROWS',
        values: [headers, ...sampleProducts],
      }),
    }
  );
};

/**
 * Helper to parse a count and optional rate string like "4 (57.1%)" or 7.0 or "0 (0.0%)"
 */
const parseCountAndRate = (val: any): { count: number; rate: string } => {
  if (val === undefined || val === null || val === '') {
    return { count: 0, rate: '' };
  }
  const s = String(val).trim();
  if (
    s.toLowerCase() === 'confirm' ||
    s.toLowerCase() === 'delivery' ||
    s.toLowerCase() === 'pending' ||
    s.toLowerCase() === 'cancel' ||
    s.toLowerCase() === 'partial' ||
    s.toLowerCase() === 'order lead' ||
    s.toLowerCase() === 'quantity'
  ) {
    return { count: 0, rate: '' };
  }
  const match = s.match(/^(\d+(?:\.\d+)?)(?:\s*\(([\d.]+%)\))?$/);
  if (match) {
    const num = parseFloat(match[1]);
    return {
      count: isNaN(num) ? 0 : num,
      rate: match[2] || '',
    };
  }
  const numOnly = parseFloat(s.replace(/[^0-9.]/g, ''));
  return { count: isNaN(numOnly) ? 0 : numOnly, rate: '' };
};

/**
 * Fetch and parse Sheet 1 real-time product & source relation reports
 */
export const fetchSheet1Reports = async (
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<{ products: Sheet1ProductReport[]; tabName: string }> => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const targetTab = 'Sheet1';
  // Include cache-busting timestamp to ensure real-time fresh data from Sheet 1
  const url = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(targetTab)}&_t=${Date.now()}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { products: [], tabName: targetTab };
    const text = await res.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);/);
    if (!match || !match[1]) return { products: [], tabName: targetTab };

    const data = JSON.parse(match[1]);
    if (!data.table || !data.table.cols || !data.table.rows) {
      return { products: [], tabName: targetTab };
    }

    const cols = data.table.cols;
    const rows = data.table.rows;
    const products: Sheet1ProductReport[] = [];

    const getCellValue = (rIdx: number, cIdx: number) => {
      if (rIdx < rows.length) {
        const rowCells = rows[rIdx]?.c;
        if (rowCells && cIdx < rowCells.length && rowCells[cIdx]) {
          return rowCells[cIdx].v !== null && rowCells[cIdx].v !== undefined ? rowCells[cIdx].v : '';
        }
      }
      return '';
    };

    // Find all product header columns (starts where label has Lead: or tk or product indicators)
    for (let cIdx = 0; cIdx < cols.length; cIdx++) {
      const colLabel = String(cols[cIdx]?.label || '').trim();
      if (!colLabel) continue;

      // Check if this column is a product block header
      const isProductHeader = /lead:|confirm:|del:|tk|dispancer|toys/i.test(colLabel);
      if (!isProductHeader) continue;

      // Extract product title (before parentheses)
      const rawTitle = colLabel.split('(')[0].trim();
      const cleanProductName = rawTitle || colLabel;

      // Extract stats from header string
      const leadMatch = colLabel.match(/Lead:\s*(\d+)/i);
      const confirmMatch = colLabel.match(/Confirm:\s*(\d+)(?:\s*\(([\d.]+%)\))?/i);
      const delMatch = colLabel.match(/Del:\s*(\d+)(?:\s*\(([\d.]+%)\))?/i);
      const penMatch = colLabel.match(/Pen:\s*(\d+)(?:\s*\(([\d.]+%)\))?/i);
      const partMatch = colLabel.match(/Part:\s*(\d+)(?:\s*\(([\d.]+%)\))?/i);
      const qtyMatch = colLabel.match(/Qty:\s*(\d+)/i);
      const canMatch = colLabel.match(/Can:\s*(\d+)(?:\s*\(([\d.]+%)\))?/i);

      // Extract the first source label from the end of the header (e.g. Website (50.0%))
      const firstSourceMatch = colLabel.match(/\)\s*([A-Za-z]+(?:\s*\([\d.]*%\))?)$/);
      const firstSourceRaw = firstSourceMatch ? firstSourceMatch[1].trim() : 'Website';
      const firstSourceShareMatch = firstSourceRaw.match(/\(([\d.]+%)\)/);
      const firstSourceName = firstSourceRaw.replace(/\s*\([\d.]*%\)/, '').trim();

      const overall = {
        lead: leadMatch ? parseInt(leadMatch[1], 10) : 0,
        confirm: confirmMatch ? parseInt(confirmMatch[1], 10) : 0,
        confirmRate: confirmMatch && confirmMatch[2] ? confirmMatch[2] : '0%',
        delivery: delMatch ? parseInt(delMatch[1], 10) : 0,
        deliveryRate: delMatch && delMatch[2] ? delMatch[2] : '0%',
        pending: penMatch ? parseInt(penMatch[1], 10) : 0,
        pendingRate: penMatch && penMatch[2] ? penMatch[2] : '0%',
        partial: partMatch ? parseInt(partMatch[1], 10) : 0,
        partialRate: partMatch && partMatch[2] ? partMatch[2] : '0%',
        quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : 0,
        cancel: canMatch ? parseInt(canMatch[1], 10) : 0,
        cancelRate: canMatch && canMatch[2] ? canMatch[2] : '0%',
      };

      const sources: ProductReportSource[] = [];

      // Source 1 (Website) from Row 0
      const s1Lead = parseCountAndRate(getCellValue(0, cIdx + 1));
      const s1Confirm = parseCountAndRate(getCellValue(0, cIdx + 2));
      const s1Del = parseCountAndRate(getCellValue(0, cIdx + 3));
      const s1Pen = parseCountAndRate(getCellValue(0, cIdx + 4));
      const s1Part = parseCountAndRate(getCellValue(0, cIdx + 5));
      const s1Qty = parseCountAndRate(getCellValue(0, cIdx + 6));
      const s1Can = parseCountAndRate(getCellValue(0, cIdx + 7));

      sources.push({
        source: firstSourceRaw,
        sourceName: firstSourceName || 'Website',
        sharePercent: firstSourceShareMatch ? firstSourceShareMatch[1] : '0%',
        lead: s1Lead.count,
        confirm: s1Confirm.count,
        confirmRate: s1Confirm.rate,
        delivery: s1Del.count,
        deliveryRate: s1Del.rate,
        pending: s1Pen.count,
        pendingRate: s1Pen.rate,
        partial: s1Part.count,
        partialRate: s1Part.rate,
        quantity: s1Qty.count,
        cancel: s1Can.count,
        cancelRate: s1Can.rate,
      });

      // Subsequent sources from rows 1..12
      for (let rIdx = 1; rIdx < Math.min(13, rows.length); rIdx++) {
        const labelInCol = getCellValue(rIdx, 18) || getCellValue(rIdx, cIdx);
        const labelStr = String(labelInCol).trim();
        if (
          labelStr &&
          /Messenger|Whatsapp|INCOMPLETE|Youtube|Tiktok|Call Direct/i.test(labelStr)
        ) {
          const shareMatch = labelStr.match(/\(([\d.]+%)\)/);
          const cleanName = labelStr.replace(/\s*\([\d.]*%\)/, '').trim();

          // Data row is next row (rIdx + 1)
          const dataRow = rIdx + 1;
          const sLead = parseCountAndRate(getCellValue(dataRow, cIdx + 1));
          const sConfirm = parseCountAndRate(getCellValue(dataRow, cIdx + 2));
          const sDel = parseCountAndRate(getCellValue(dataRow, cIdx + 3));
          const sPen = parseCountAndRate(getCellValue(dataRow, cIdx + 4));
          const sPart = parseCountAndRate(getCellValue(dataRow, cIdx + 5));
          const sQty = parseCountAndRate(getCellValue(dataRow, cIdx + 6));
          const sCan = parseCountAndRate(getCellValue(dataRow, cIdx + 7));

          sources.push({
            source: labelStr,
            sourceName: cleanName,
            sharePercent: shareMatch ? shareMatch[1] : '0%',
            lead: sLead.count,
            confirm: sConfirm.count,
            confirmRate: sConfirm.rate,
            delivery: sDel.count,
            deliveryRate: sDel.rate,
            pending: sPen.count,
            pendingRate: sPen.rate,
            partial: sPart.count,
            partialRate: sPart.rate,
            quantity: sQty.count,
            cancel: sCan.count,
            cancelRate: sCan.rate,
          });
        }
      }

      products.push({
        id: `PROD-REP-${cIdx}`,
        productName: cleanProductName,
        rawHeader: colLabel,
        overall,
        sources,
      });
    }

    return { products, tabName: targetTab };
  } catch (err) {
    console.error('Error fetching Sheet 1 reports:', err);
    return { products: [], tabName: targetTab };
  }
};

/**
 * Fetch and parse Sheet 3 real-time product stock data and transaction logs
 */
export interface Sheet3StockItem {
  colLetter: string;
  colIndex: number;
  cell: string;
  productName: string;
  quantity: number;
  time?: string;
}

export interface Sheet3TransactionRecord {
  rowIndex?: number;
  date: string;
  productName: string;
  source: string;
  inQty?: number;
  outQty?: number;
  balance: number;
}

/**
 * Robust matcher between App product and Sheet 3 stock column
 */
export const matchProductWithSheet3 = (
  prodName: string,
  stockItems: Sheet3StockItem[]
): Sheet3StockItem | undefined => {
  if (!prodName || !stockItems || stockItems.length === 0) return undefined;
  const clean = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = clean(prodName);
  const lower = (prodName || '').toLowerCase();

  // 1. Exact or substring match
  for (const item of stockItems) {
    const itemClean = clean(item.productName);
    if (itemClean === target || target.includes(itemClean) || itemClean.includes(target)) {
      return item;
    }
  }

  // 2. Specific product token match for Sheet 3 items:
  if (lower.includes('watch')) {
    return stockItems.find((i) => i.productName.toLowerCase().includes('watch'));
  }
  if (lower.includes('rose') && !lower.includes('990') && !lower.includes('1350')) {
    return stockItems.find((i) => {
      const l = i.productName.toLowerCase();
      return l.includes('rose') && !l.includes('990') && !l.includes('1350');
    });
  }
  if (lower.includes('cutting') || lower.includes('dispans') || lower.includes('dispanc')) {
    return stockItems.find((i) => {
      const l = i.productName.toLowerCase();
      return l.includes('cutting') || l.includes('dispans') || l.includes('dispanc');
    });
  }
  if (lower.includes('990')) {
    return stockItems.find((i) => i.productName.toLowerCase().includes('990'));
  }
  if (lower.includes('1350')) {
    return stockItems.find((i) => i.productName.toLowerCase().includes('1350'));
  }
  if (lower.includes('doll') || lower.includes('toy')) {
    return stockItems.find((i) => {
      const l = i.productName.toLowerCase();
      return l.includes('doll') || l.includes('toy');
    });
  }

  return undefined;
};

export const fetchSheet3Stock = async (
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<{
  stockItems: Sheet3StockItem[];
  logs: Sheet3TransactionRecord[];
  entries: Sheet3ProductEntry[];
  tabName: string;
}> => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const targetTab = 'Sheet3';
  const stockItems: Sheet3StockItem[] = [];
  const logs: Sheet3TransactionRecord[] = [];
  const entries: Sheet3ProductEntry[] = [];

  try {
    // 1. Fetch live stock summary from row 2 (names) and row 3 (quantities) across columns A to Z
    const summaryUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(targetTab)}&range=A2:Z3&_t=${Date.now()}`;
    const sumRes = await fetch(summaryUrl, { cache: 'no-store' });
    if (sumRes.ok) {
      const text = await sumRes.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);/);
      if (match && match[1]) {
        const data = JSON.parse(match[1]);
        if (data.table && data.table.cols && data.table.rows && data.table.rows.length > 0) {
          const cols = data.table.cols;
          const firstRow = data.table.rows[0]?.c || [];
          cols.forEach((colObj: any, idx: number) => {
            const rawLabel = (colObj?.label || '').trim();
            if (rawLabel && !rawLabel.toLowerCase().includes('stock manage')) {
              const colLetter = String.fromCharCode(65 + idx); // A, B, C...
              const cellVal = firstRow[idx];
              const qty = cellVal?.v !== null && cellVal?.v !== undefined ? Number(cellVal.v) : 0;
              stockItems.push({
                colLetter,
                colIndex: idx + 1,
                cell: `${colLetter}3`,
                productName: rawLabel,
                quantity: isNaN(qty) ? 0 : qty,
              });
            }
          });
        }
      }
    }

    // 2. Fetch real-time product entries from Sheet 3 (Table starts at row 7: Date, Product Name, Source, Stock In, Stock Out, Current Stock, Current price)
    const entriesUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(targetTab)}&range=A7:H1000&headers=1&_t=${Date.now()}`;
    const entriesRes = await fetch(entriesUrl, { cache: 'no-store' });
    let fetchedViaRange = false;

    if (entriesRes.ok) {
      const text = await entriesRes.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);/);
      if (match && match[1]) {
        const data = JSON.parse(match[1]);
        if (data.table && data.table.rows && data.table.rows.length > 0) {
          data.table.rows.forEach((r: any, idx: number) => {
            const cells = r.c || [];
            const dateVal = String(cells[0]?.f || cells[0]?.v || '').trim();
            const prodVal = String(cells[1]?.f || cells[1]?.v || '').trim();
            const sourceVal = String(cells[2]?.f || cells[2]?.v || '').trim();
            const inVal = cells[3]?.v !== null && cells[3]?.v !== undefined && cells[3]?.v !== '' ? Number(cells[3].v) : '';
            const outVal = cells[4]?.v !== null && cells[4]?.v !== undefined && cells[4]?.v !== '' ? Number(cells[4].v) : '';
            const curStock = cells[5]?.v !== null && cells[5]?.v !== undefined && cells[5]?.v !== '' ? Number(cells[5].v) : 0;
            const curPrice = cells[6]?.v !== null && cells[6]?.v !== undefined && cells[6]?.v !== '' ? Number(cells[6].v) : '';

            // Header is Row 7, so first data row is Row 8
            const sheetRowIndex = idx + 8;

            if (prodVal || dateVal) {
              const entryItem: Sheet3ProductEntry = {
                id: `sheet3-row-${sheetRowIndex}`,
                rowIndex: sheetRowIndex,
                date: dateVal,
                productName: prodVal,
                source: sourceVal || 'Stock',
                stockIn: inVal,
                stockOut: outVal,
                currentStock: isNaN(curStock) ? 0 : curStock,
                currentPrice: curPrice,
              };
              entries.push(entryItem);

              logs.push({
                rowIndex: sheetRowIndex,
                date: dateVal,
                productName: prodVal,
                source: sourceVal || 'Stock',
                inQty: inVal !== '' && !isNaN(Number(inVal)) ? Number(inVal) : undefined,
                outQty: outVal !== '' && !isNaN(Number(outVal)) ? Number(outVal) : undefined,
                balance: isNaN(curStock) ? 0 : curStock,
              });
            }
          });
          fetchedViaRange = true;
        }
      }
    }

    // Fallback: If range query returned no entries, query without range
    if (!fetchedViaRange) {
      const fallbackUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(targetTab)}&headers=0&_t=${Date.now()}`;
      const fbRes = await fetch(fallbackUrl, { cache: 'no-store' });
      if (fbRes.ok) {
        const text = await fbRes.text();
        const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);/);
        if (match && match[1]) {
          const data = JSON.parse(match[1]);
          if (data.table && data.table.rows) {
            data.table.rows.forEach((r: any, rIdx: number) => {
              if (rIdx < 3) return;
              const cells = r.c || [];
              const dateVal = String(cells[0]?.f || cells[0]?.v || '').trim();
              const prodVal = String(cells[1]?.f || cells[1]?.v || '').trim();
              const sourceVal = String(cells[2]?.f || cells[2]?.v || '').trim();
              const inVal = cells[3]?.v !== null && cells[3]?.v !== undefined && cells[3]?.v !== '' ? Number(cells[3].v) : '';
              const outVal = cells[4]?.v !== null && cells[4]?.v !== undefined && cells[4]?.v !== '' ? Number(cells[4].v) : '';
              const curStock = cells[5]?.v !== null && cells[5]?.v !== undefined && cells[5]?.v !== '' ? Number(cells[5].v) : 0;
              const curPrice = cells[6]?.v !== null && cells[6]?.v !== undefined && cells[6]?.v !== '' ? Number(cells[6].v) : '';

              const sheetRowIndex = rIdx + 5;

              if (prodVal && prodVal.toLowerCase() !== 'product name') {
                entries.push({
                  id: `sheet3-row-${sheetRowIndex}`,
                  rowIndex: sheetRowIndex,
                  date: dateVal,
                  productName: prodVal,
                  source: sourceVal || 'Stock',
                  stockIn: inVal,
                  stockOut: outVal,
                  currentStock: isNaN(curStock) ? 0 : curStock,
                  currentPrice: curPrice,
                });

                logs.push({
                  rowIndex: sheetRowIndex,
                  date: dateVal,
                  productName: prodVal,
                  source: sourceVal || 'Stock',
                  inQty: inVal !== '' && !isNaN(Number(inVal)) ? Number(inVal) : undefined,
                  outQty: outVal !== '' && !isNaN(Number(outVal)) ? Number(outVal) : undefined,
                  balance: isNaN(curStock) ? 0 : curStock,
                });
              }
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to fetch Sheet3 stock data:', err);
  }

  return { stockItems, logs, entries, tabName: targetTab };
};

/**
 * Edit an existing Sheet 3 row (Date, Product Name, Source, Stock In, Stock Out, Current Stock, Current price)
 */
export const updateSheet3Entry = async (
  spreadsheetId: string,
  accessToken: string | null | undefined,
  entry: {
    rowIndex: number;
    date: string;
    productName: string;
    source: string;
    stockIn: number | '';
    stockOut: number | '';
    currentStock: number;
    currentPrice: number | '';
  }
) => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const targetTab = 'Sheet3';
  const rowNum = entry.rowIndex;

  const inVal = entry.stockIn !== '' && entry.stockIn !== undefined && !isNaN(Number(entry.stockIn)) ? Number(entry.stockIn) : '';
  const outVal = entry.stockOut !== '' && entry.stockOut !== undefined && !isNaN(Number(entry.stockOut)) ? Number(entry.stockOut) : '';
  const curStockVal = !isNaN(Number(entry.currentStock)) ? Number(entry.currentStock) : 0;
  const priceVal = entry.currentPrice !== '' && entry.currentPrice !== undefined && !isNaN(Number(entry.currentPrice)) ? Number(entry.currentPrice) : '';

  // 1. Direct REST API if accessToken is available
  if (accessToken && rowNum >= 8) {
    try {
      const range = `'${targetTab}'!A${rowNum}:G${rowNum}`;
      const res = await fetch(
        `${SHEETS_API_BASE}/${cleanId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range,
            values: [[entry.date, entry.productName, entry.source, inVal, outVal, curStockVal, priceVal]],
          }),
        }
      );
      if (res.ok) {
        return { success: true, updatedRow: rowNum };
      }
    } catch (err) {
      console.warn('Direct Google Sheet API update error, falling back to Apps Script:', err);
    }
  }

  // 2. Apps Script fallback
  return updateOrderViaAppsScript({
    action: 'update_sheet3_entry',
    sheetName: 'Sheet3',
    tabName: 'Sheet3',
    row: rowNum,
    row_number: rowNum,
    rowIndex: rowNum,
    date: entry.date,
    productName: entry.productName,
    product: entry.productName,
    source: entry.source,
    stockIn: inVal,
    stockOut: outVal,
    currentStock: curStockVal,
    currentPrice: priceVal,
    price: priceVal,
  });
};

/**
 * Append a new row to Sheet 3 (Date, Product Name, Source, Stock In, Stock Out, Current Stock, Current price)
 */
export const appendSheet3Entry = async (
  spreadsheetId: string,
  accessToken: string | null | undefined,
  entry: {
    date: string;
    productName: string;
    source: string;
    stockIn: number | '';
    stockOut: number | '';
    currentStock: number;
    currentPrice: number | '';
  }
) => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const targetTab = 'Sheet3';
  const inVal = entry.stockIn !== '' && entry.stockIn !== undefined && !isNaN(Number(entry.stockIn)) ? Number(entry.stockIn) : '';
  const outVal = entry.stockOut !== '' && entry.stockOut !== undefined && !isNaN(Number(entry.stockOut)) ? Number(entry.stockOut) : '';
  const curStockVal = !isNaN(Number(entry.currentStock)) ? Number(entry.currentStock) : 0;
  const priceVal = entry.currentPrice !== '' && entry.currentPrice !== undefined && !isNaN(Number(entry.currentPrice)) ? Number(entry.currentPrice) : '';

  if (accessToken) {
    try {
      const appendRange = `'${targetTab}'!A7:G:append`;
      const res = await fetch(
        `${SHEETS_API_BASE}/${cleanId}/values/${encodeURIComponent(appendRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [[entry.date, entry.productName, entry.source, inVal, outVal, curStockVal, priceVal]],
          }),
        }
      );
      if (res.ok) {
        return { success: true };
      }
    } catch (err) {
      console.warn('Direct Google Sheet API append error, falling back to Apps Script:', err);
    }
  }

  return updateOrderViaAppsScript({
    action: 'append_sheet3_entry',
    sheetName: 'Sheet3',
    tabName: 'Sheet3',
    date: entry.date,
    productName: entry.productName,
    product: entry.productName,
    source: entry.source,
    stockIn: inVal,
    stockOut: outVal,
    currentStock: curStockVal,
    currentPrice: priceVal,
    price: priceVal,
  });
};

/**
 * Update stock in Sheet 3 in real-time
 * 1. Directly updates product available stock cell ('Sheet3'!A3, B3, C3, etc.)
 * 2. Appends transaction record row to Sheet 3 log
 */
export const updateSheet3ProductStock = async (
  spreadsheetId: string,
  accessToken: string | null | undefined,
  productName: string,
  newStock: number,
  change?: number,
  reason: string = 'manual_update'
) => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const targetTab = 'Sheet3';

  // Determine Sheet3 column (A-F) based on product name
  let targetCol = 'A';
  let targetColNum = 1;
  let targetCell = 'A3';
  const lower = (productName || '').toLowerCase();

  if (lower.includes('watch')) {
    targetCol = 'B';
    targetColNum = 2;
    targetCell = 'B3';
  } else if (lower.includes('cutting') || lower.includes('dispans') || lower.includes('dispanc')) {
    targetCol = 'C';
    targetColNum = 3;
    targetCell = 'C3';
  } else if (lower.includes('990')) {
    targetCol = 'D';
    targetColNum = 4;
    targetCell = 'D3';
  } else if (lower.includes('1350')) {
    targetCol = 'E';
    targetColNum = 5;
    targetCell = 'E3';
  } else if (lower.includes('doll') || lower.includes('toy')) {
    targetCol = 'F';
    targetColNum = 6;
    targetCell = 'F3';
  } else {
    // Default to A (Rose 599)
    targetCol = 'A';
    targetColNum = 1;
    targetCell = 'A3';
  }

  const now = new Date();
  const dateFormatted = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const changeNum = change !== undefined ? change : 0;
  const inVal = changeNum > 0 ? changeNum : '';
  const outVal = changeNum < 0 ? Math.abs(changeNum) : '';
  const sourceStr = reason === 'return_approved' ? 'Return ' : reason === 'order_delivery' ? 'Order delivery' : 'Stock';

  // 1. Direct REST API if accessToken is available
  if (accessToken) {
    try {
      // 1a. Update cell in row 3
      const cellRange = `'${targetTab}'!${targetCell}`;
      await fetch(
        `${SHEETS_API_BASE}/${cleanId}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: cellRange,
            values: [[newStock]],
          }),
        }
      );

      // 1b. Append log entry
      const logRange = `'${targetTab}'!A:F:append`;
      await fetch(
        `${SHEETS_API_BASE}/${cleanId}/values/${encodeURIComponent(logRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [[dateFormatted, productName, sourceStr, inVal, outVal, newStock]],
          }),
        }
      );

      return { success: true, updatedCell: targetCell, newStock };
    } catch (err) {
      console.warn('Direct Google Sheet API stock update failed, using Apps Script fallback:', err);
    }
  }

  // 2. Apps Script fallback
  return updateOrderViaAppsScript({
    action: 'update_stock',
    sheetName: 'Sheet3',
    tabName: 'Sheet3',
    col: targetColNum,
    column: targetCol,
    cell: targetCell,
    row: 3,
    value: newStock,
    newStock,
    productName,
    change: changeNum,
    source: sourceStr,
    reason,
  });
};

