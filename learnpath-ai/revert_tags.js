const fs = require("fs");
let code = fs.readFileSync("D:/ai_creation2/learnpath-ai/script.js", "utf8");

const start = code.indexOf("roadmap-thumb-tag");
const blockStart = code.lastIndexOf("const bvid", start);
const blockEnd = code.indexOf("</div>", start) + "</div>".length;
const stmtEnd = code.indexOf(";", blockEnd) + 1;

const nl = "\n";
const Q = "'";
const BS = "\\";

const newBlock = 
    "const bvid = v.bvid;" + nl +
    "                html += " + Q + '<div class="roadmap-video-tag" data-bvid="' + Q + " + bvid;" + nl +
    "                html += " + Q + '" onclick="scrollToVideo(' + BS + Q + " + bvid + " + BS + Q + ')">' + Q + ";" + nl +
    "                html += " + Q + '<span class="order-badge">' + Q + " + order + " + Q + "</span> " + Q + ";" + nl +
    "                html += title + " + Q + "</div>" + Q + ";";

code = code.substring(0, blockStart) + newBlock + code.substring(stmtEnd);
fs.writeFileSync("D:/ai_creation2/learnpath-ai/script.js", code, "utf8");

try {
    new (require("vm").Script)(code);
    console.log("JS OK");
} catch(e) {
    console.log("ERROR:", e.message.substring(0, 150));
}
