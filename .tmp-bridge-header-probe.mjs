import fs from 'node:fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(x=>/^[A-Z0-9_]+=/.test(x)).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)]}));
for(let i=0;i<8;i++){const r=await fetch(env.CH_API_URL.replace(/\/$/,'')+'/customer/me',{headers:{'X-CH-Auth-Bridge':env.CH_AUTH_BRIDGE_SECRET},cache:'no-store'});let b={};try{b=await r.json()}catch{};console.log(`WP_NO_SESSION_PROBE_${i+1}=${r.status}:${b?.error?.code??'none'}`)}
