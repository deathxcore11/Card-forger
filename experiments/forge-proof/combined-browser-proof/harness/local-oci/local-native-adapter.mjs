// LOCAL_TEST_NOT_DEPLOYABLE. Only a directly imported disposable fixture factory.
import assert from 'node:assert/strict';import path from 'node:path';
import {SCOPE,assertVerifiedLocalIdentity} from './oci-identity.mjs';
import {existingNativeTransport,selectedPolicy,boundedJSON,NATIVE_SCHEMA,reviewedHostRoot} from './reviewed-host.mjs';
import {validateLocalTestPolicy,verifyExactLocalInitialization} from './local-test-policy.mjs';
export function createLocalNativeAdapter({identity,policy,localTestScope,serviceRoot=reviewedHostRoot,now=Date.now}){
 assert(localTestScope===SCOPE&&path.resolve(serviceRoot)===reviewedHostRoot,'Explicit reviewed LOCAL_TEST_NOT_DEPLOYABLE fixture binding required');
 assertVerifiedLocalIdentity(identity);validateLocalTestPolicy(policy,identity,now());
 const transport=existingNativeTransport({});
 return {
  get ready(){try{validateLocalTestPolicy(policy,identity,now());return true;}catch{return false;}},
  validateAdmissionInput(input){selectedPolicy(input?.difficultyPolicyVersion);},
  async startOptions(options){validateLocalTestPolicy(policy,identity,now());selectedPolicy(options.input?.difficultyPolicyVersion);return transport.startOptions(options);},
  bootstrapExisting:transport.bootstrapExisting,
  readStartupFailure:transport.readStartupFailure,
  async confirmInitialization({allocation,input,epoch,internalToken,fetchExisting}){
   validateLocalTestPolicy(policy,identity,now());selectedPolicy(input?.difficultyPolicyVersion);
   const response=await fetchExisting(new Request('http://host001.internal/state',{headers:{Authorization:'Bearer '+internalToken,'Content-Type':'application/json'},redirect:'manual',signal:AbortSignal.timeout(5000)}));
   assert(response.status===200,'initialization_http_failure');
   const responseHeaders=Object.fromEntries(['x-host-epoch','x-host-native-source-sha256','x-host-native-manifest-sha256'].map(k=>[k,response.headers.get(k)]));
   const state=await boundedJSON(response,4*1024*1024,AbortSignal.timeout(5000));
   await verifyExactLocalInitialization({state,responseStatus:response.status,responseHeaders,epoch,input,allocation,policy,identity,now:now()});
   return {...state.initialization,schema:NATIVE_SCHEMA};
  },
 };
}
