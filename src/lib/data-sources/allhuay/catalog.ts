import type { LotteryDefinition } from "../../types";

const categoryPattern=/\{\\?"type\\?":\\?"([^"]+)\\?",\\?"name\\?":\\?"([^"]+)\\?",\\?"value\\?":\[([\s\S]*?)\]\}/g;
const entryPattern=/\{\\?"en\\?":\\?"([^"]+)\\?",\\?"th\\?":\\?"([^"]+)\\?",\\?"flag\\?":\\?"([^"]*)\\?"\}/g;
export function parseAllHuayCatalog(html:string):LotteryDefinition[]{const decoded=html.replaceAll('\\"','"');const seen=new Set<string>();const results:LotteryDefinition[]=[];for(const category of decoded.matchAll(categoryPattern)){for(const entry of category[3].matchAll(entryPattern)){const slug=entry[1];if(seen.has(slug))continue;seen.add(slug);results.push({id:slug,name:entry[2],slug,category:category[2],sourceUrl:`https://www.allhuay.com/lotto/${slug}`,isActive:true,capabilities:{top3:true,top2:true,bottom2:true}})}}return results;}
export function findLottery(catalog:LotteryDefinition[],id:string){return catalog.find(x=>x.id===id);}
export function searchLotteries(catalog:LotteryDefinition[],query:string){const needle=query.trim().toLocaleLowerCase("th");return needle?catalog.filter(x=>`${x.name} ${x.slug} ${x.category}`.toLocaleLowerCase("th").includes(needle)):catalog;}
