import type { Snapshot, SnapshotFreshness } from "./cache";
import { writeSnapshot, computeHistoryVersion } from "./cache";
import type { CanonicalHistoryResult, LotteryDraw } from "./types";
import { countNewDraws, mergeDrawHistory } from "./freshness";
import { validateHistoryIntegrity } from "./data-sources/integrity";

export type SyncDecision={ok:true;outcome:"updated"|"unchanged";draws:LotteryDraw[];addedDraws:number}|{ok:false;outcome:"parse-failure"|"validation-failure";reason:string};
export function validateCanonicalSync(existing:Snapshot|null,incoming:CanonicalHistoryResult,limit=100):SyncDecision{
 if(!incoming.draws.length)return{ok:false,outcome:"parse-failure",reason:"source produced 0 valid draws"};
 const issues=validateHistoryIntegrity(incoming.draws,incoming.draws[0].lotteryId);
 if(issues.length)return{ok:false,outcome:"validation-failure",reason:issues[0].reason};
 if(existing&&existing.draws.length>=20&&incoming.draws.length<Math.max(3,Math.floor(existing.draws.length*.25)))return{ok:false,outcome:"validation-failure",reason:`suspicious truncation: ${incoming.draws.length}/${existing.draws.length} draws`};
 const draws=mergeDrawHistory(existing?.draws??[],incoming.draws,limit),addedDraws=countNewDraws(existing?.draws??[],draws),previous=existing?.historyVersion??(existing?computeHistoryVersion(existing.lotteryId,existing.draws):null),next=computeHistoryVersion(incoming.draws[0].lotteryId,draws);
 return{ok:true,outcome:previous===next?"unchanged":"updated",draws,addedDraws};
}
export async function commitCanonicalSync(input:{lotteryId:string;existing:Snapshot|null;incoming:CanonicalHistoryResult;freshness:SnapshotFreshness}):Promise<{snapshot:Snapshot;outcome:"updated"|"unchanged";addedDraws:number}>{const decision=validateCanonicalSync(input.existing,input.incoming);if(!decision.ok)throw new CanonicalSyncError(decision.outcome,decision.reason);const snapshot=await writeSnapshot(input.lotteryId,decision.draws,input.freshness,{currentSourceResultDate:input.incoming.currentSourceResultDate,providerResultStatus:input.incoming.providerResultStatus,providerStatusRaw:input.incoming.providerStatusRaw,syncOutcome:decision.outcome});return{snapshot,outcome:decision.outcome,addedDraws:decision.addedDraws}}
export class CanonicalSyncError extends Error{constructor(readonly outcome:"parse-failure"|"validation-failure",message:string){super(message)}}
