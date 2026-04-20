const fs = require("fs");
const path = require("path");

const replacements = {
  "Ã¢â‚¬â€": "—",
  "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â": "—",
  "Ã¢â€žâ€“": "№",
  "ÃƒÂ¢Ã¢â‚¬Å¾Ã¢â‚¬â€œ": "№",
  "ÃƒÂ¢Ã¢â‚¬Â Ã‚Â ": "← ",
  "Ãƒâ€šÃ‚Â·": "•",
  "ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“": "✓",
  "ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¢": "✗",
  "Ã¢Å“â€¢": "✕",
  "Ãƒâ€šÃ‚Â": " "
};

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith(".tsx") || file.endsWith(".ts")) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk("./src");
let changedCount = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, "utf8");
  let modified = false;
  for (const [bad, good] of Object.entries(replacements)) {
    if (content.includes(bad)) {
      content = content.split(bad).join(good);
      modified = true;
    }
  }
  if (modified) {
    fs.writeFileSync(file, content, "utf8");
    console.log("Fixed", file);
    changedCount++;
  }
});
console.log("Fixed " + changedCount + " files.");
