// api/submit.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Only POST is allowed' });
    return;
  }

  const { notionToken, databaseId, data } = req.body;

  try {
    const notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: data
      })
    });

    const result = await notionRes.json();
    res.status(notionRes.status).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Notion request failed', details: err.message });
  }
}
