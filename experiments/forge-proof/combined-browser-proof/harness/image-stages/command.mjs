// Bounded subprocesses only, never shell interpolation. Nothing is logged here.
import {spawn} from 'node:child_process';import {createWriteStream} from 'node:fs';
export async function command(file,args,{stdin,signal,timeoutMs=10000,maxOutputBytes=1024*1024,outputFile}={}){
 if(!Array.isArray(args)||!args.every(x=>typeof x==='string')||!Number.isSafeInteger(timeoutMs)||timeoutMs<1)throw Error('invalid_bounded_command');
 return new Promise((resolve,reject)=>{
  const p=spawn(file,args,{stdio:['pipe','pipe','pipe'],detached:true,env:process.env});let total=0,done=false,failed=null,stdout=[],stderr=[];
  const log=outputFile?createWriteStream(outputFile,{flags:'wx',mode:0o600}):null;
  const kill=()=>{try{process.kill(-p.pid,'SIGTERM');}catch{}};
  let hard;
  const abort=()=>{if(!failed)failed=Error('bounded_command_aborted');kill();hard=setTimeout(()=>{try{process.kill(-p.pid,'SIGKILL');}catch{}},3000);};
  const timer=setTimeout(()=>{failed=Error('bounded_command_timeout');abort();},timeoutMs);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const receive=(list,data)=>{total+=data.length;if(total>maxOutputBytes){failed=Error('bounded_command_output_limit');abort();return;}if(log)log.write(data);else list.push(data);};
  p.stdout.on('data',data=>receive(stdout,data));p.stderr.on('data',data=>receive(stderr,data));log?.on('error',e=>{failed=Error('private_command_log_unavailable');abort();});
  const finish=()=>{clearTimeout(timer);clearTimeout(hard);signal?.removeEventListener('abort',abort);};
  p.on('error',()=>{if(done)return;done=true;finish();log?.end();reject(Error('bounded_command_start_failed'));});
  p.on('close',code=>{if(done)return;done=true;finish();const end=()=>failed||code!==0?reject(failed||Error('bounded_command_failed')):resolve({stdout:Buffer.concat(stdout),stderr:Buffer.concat(stderr),code});if(log)log.end(end);else end();});
  p.stdin.on('error',()=>{});p.stdin.end(stdin??undefined);
 });
}
