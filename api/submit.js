export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const { notionToken, databaseId, properties } = req.body;
  const r = await fetch('https://api.notion.com/v1/pages',{
    method:'POST',
    headers:{
      Authorization:`Bearer ${notionToken}`,
      'Notion-Version':'2022-06-28',
      'Content-Type':'application/json'
    },
    body:JSON.stringify({parent:{database_id:databaseId},properties})
  });
  const j=await r.json(); res.status(r.status).json(j);
};
