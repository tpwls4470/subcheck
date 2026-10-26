export const appReturn='http://127.0.0.1:4320/';
export function returnDestination(value){return value==='app'?appReturn:'/';}
export function clearConnection(session){
  session.accessToken=null;
  session.expiresAt=0;
  session.lastResult=null;
  session.sessionId=null;
  session.protocolVersion=null;
  session.initialized=false;
  session.lastRefresh=0;
  session.status='';
}
