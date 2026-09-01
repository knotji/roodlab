// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveResultsPage } from "./live-results-page";
import type { LiveBoardItem } from "@/lib/live-board";

afterEach(()=>{cleanup();vi.unstubAllGlobals()});
const item=(overrides:Partial<LiveBoardItem>):LiveBoardItem=>({id:"laotv",name:"ลาวทีวี",category:"ลาว",resultAt:"10:30",closeAt:"10:20",resultUrl:"https://lao-tv.com",backupUrl:null,sourceUrl:"https://example.com",status:"resulted",resultMinutes:630,drawDate:"2026-09-01",top3:"123",top2:"23",bottom2:"45",syncedAt:"2026-09-01T03:31:00Z",...overrides});
describe("LiveResultsPage",()=>{
  it("renders canonical results, filters status, and opens Analyze",async()=>{
    const onAnalyze=vi.fn(),items=[item({}),item({id:"xosohd",name:"ฮานอย HD",category:"ฮานอย",status:"upcoming",resultAt:"11:30",resultMinutes:690,drawDate:null,top3:null,top2:null,bottom2:null})];
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({ok:true,date:"2026-09-01",updatedAt:"2026-09-01T03:31:00Z",scheduled:2,total:2,items})}));
    render(<LiveResultsPage onAnalyze={onAnalyze}/>);
    expect(await screen.findByText("ลาวทีวี")).toBeTruthy();
    expect(screen.getByText("123")).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("ทุกสถานะ"),{target:{value:"upcoming"}});
    expect(screen.queryByText("ลาวทีวี")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"วิเคราะห์"}));
    expect(onAnalyze).toHaveBeenCalledWith("xosohd");
  });
});
