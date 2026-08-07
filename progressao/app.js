
const CONFIG={url:'https://gtmngtweohixfeajljik.supabase.co',key:'sb_publishable_MDNyO5yGhyYJz23QZS-CGw_b0ymShkF'};
const client=window.supabase.createClient(CONFIG.url,CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true}});
const routes={welcome:'/boas-vindas/',assessment:'/avaliacao-inicial/',waiting_healer:'/tela-espera/',dashboard:'/painel-aventureiro/',checkpoint:'/checkpoint/',feedback:'/feedback-evolucao/',progression:'/progressao/'};
async function refreshStage(){
 const {data:{user}}=await client.auth.getUser();
 if(!user){location.replace('/login/');return;}
 const {data,error}=await client.from('profiles').select('preferred_name,journey_stage').eq('id',user.id).maybeSingle();
 if(error){document.querySelector('#status').textContent='Não foi possível atualizar agora.';return;}
 document.querySelector('#name').textContent=data?.preferred_name||'Aventureiro';
 const current=document.body.dataset.stage;
 if(data?.journey_stage && data.journey_stage!==current){location.replace(routes[data.journey_stage]||'/login/');return;}
 document.querySelector('#status').textContent='Status atualizado. Sua etapa permanece em análise.';
}
document.querySelector('#refresh')?.addEventListener('click',refreshStage);
refreshStage();
