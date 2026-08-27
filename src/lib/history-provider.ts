import type { Snapshot } from "./cache";
import { computeHistoryVersion } from "./history-version";
import { summarizeDataIntegrity,usableAnalysisHistory } from "./data-sources/integrity";
export function getCanonicalDataset(snapshot:Snapshot|undefined,requestedDraws:number){const history=snapshot?.draws??[],historyVersion=snapshot?.historyVersion??computeHistoryVersion(snapshot?.lotteryId??"unknown",history),analysisHistory=usableAnalysisHistory(history);return{lotteryId:snapshot?.lotteryId??null,history,analysisHistory,historyVersion,latestDrawDate:history[0]?.drawDate??null,integrity:summarizeDataIntegrity(history,requestedDraws)}}
export function canonicalDatasetIdentity(snapshot:Snapshot|undefined){const data=getCanonicalDataset(snapshot,Number.MAX_SAFE_INTEGER);return{lotteryId:data.lotteryId,latestDrawDate:data.latestDrawDate,historyLength:data.history.length,historyVersion:data.historyVersion}}
