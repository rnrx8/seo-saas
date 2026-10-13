import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'

async function extension(result) {
  const created=[],removed=[];let listener
  const context={URL,setTimeout:fn=>{fn();return 1}, readGoogleResults(){},chrome:{
    tabs:{create:async options=>{created.push(options);return {id:7}},get:async()=>({status:'complete',url:created[0].url}),remove:async id=>removed.push(id)},
    scripting:{executeScript:async()=>[{result}]},runtime:{onMessage:{addListener:fn=>listener=fn}},
  }}
  const source=(await readFile('extensions/dig-serp-browser/background.js','utf8')).replace("import { readGoogleResults } from './extractor.mjs'",'')
  vm.runInNewContext(source,context)
  const response=await new Promise(resolve=>listener({action:'capture',query:'確認クエリ'},{url:'https://app.deepintentgraph.com/dashboard',frameId:0},resolve))
  return {created,removed,response}
}

test('new generation captures in a background tab and closes it after success',async()=>{
 const value=await extension({snapshot:{organic_results:[{link:'https://example.com'}]}})
 assert.equal(value.created[0].active,false)
 assert.equal(new URL(value.created[0].url).searchParams.get('q'),'確認クエリ')
 assert.deepEqual(value.removed,[7]);assert.ok(value.response.snapshot)
})
test('a CAPTCHA error does not switch to Google or return invented search results',async()=>{
 const value=await extension({error:'Googleで認証が必要です'})
 assert.equal(value.created[0].active,false);assert.equal(value.response.error,'Googleで認証が必要です');assert.equal(value.response.snapshot,undefined)
})

globalThis.__digSupabase={auth:{getSession:async()=>({data:{session:{access_token:'fixture-token'}}})}}
const source=(await readFile('app/_lib/browser-serp.js','utf8')).replace("import { getSupabase } from '@/lib/supabase'",'const getSupabase = () => globalThis.__digSupabase')
const helpers=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
test('retry sends only the existing job ID to authenticated resume, without a browser request',async()=>{
 globalThis.window={postMessage(){throw Error('Must not capture search on retry')}}
 let request
 globalThis.fetch=async(url,options)=>{request={url,...options};return {ok:true,json:async()=>({status:'started'})}}
 assert.deepEqual(await helpers.resumeGeneration({id:'job',main_keyword:'query'}),{status:'started'})
 assert.equal(request.url,'/api/resume');assert.deepEqual(JSON.parse(request.body),{job_id:'job'});assert.equal(request.headers.Authorization,'Bearer fixture-token')
})
test('an old foreground-opening extension is rejected before capture or job insertion',async()=>{
 const surface=new EventTarget();globalThis.window=surface;globalThis.location={origin:'https://app.deepintentgraph.com'}
 let captures=0,inserts=0
 surface.postMessage=message=>{
  if(message.action==='capture')captures++
  const event=new Event('message');Object.assign(event,{source:surface,origin:location.origin,data:{channel:'dig-serp-response',id:message.id,version:'1.0.0'}});surface.dispatchEvent(event)
 }
 const result=await helpers.createBrowserJob({from(){inserts++;throw Error('Must not insert')}},{main_keyword:'query'})
 assert.match(result.error.message,/拡張機能/);assert.equal(captures,0);assert.equal(inserts,0)
})
const route=await import('data:text/javascript;base64,'+Buffer.from(await readFile('app/api/resume/route.js','utf8')).toString('base64'))
test('resume proxy rejects unauthenticated requests before contacting the pipeline',async()=>{
 globalThis.fetch=()=>{throw Error('Must not proxy')}
 const res=await route.POST(new Request('https://app.deepintentgraph.com/api/resume',{method:'POST',body:'{}'}))
 assert.equal(res.status,401)
})
