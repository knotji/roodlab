import { readCatalog } from "../src/lib/cache";
import { auditCatalog } from "../src/lib/data-sources/allhuay/audit";
const report=await auditCatalog(await readCatalog());
console.log(JSON.stringify(report,null,2));
