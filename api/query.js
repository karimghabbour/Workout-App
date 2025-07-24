export default async (req,res)=>{
  if(req.method!=='POST')return res.status(405).end();
  const { notionToken,databaseId,body }=req.body;
  const r=await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`,{
    method:'POST',
    headers:{
      Authorization:`Bearer ${notionToken}`,
      'Notion-Version':'2022-06-28',
      'Content-Type':'application/json'
    },
    body:JSON.stringify(body)
  });
  const j=await r.json(); res.status(r.status).json(j);
};
