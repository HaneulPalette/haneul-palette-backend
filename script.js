// script.js - Haneul Palette basic client-side analysis + PDF

// DOM references
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const ctx = preview.getContext('2d');

const results = document.getElementById('results');
const undertoneEl = document.getElementById('undertone');
const undertoneExpl = document.getElementById('undertoneExpl');
const brightsoftEl = document.getElementById('brightsoft');
const depthEl = document.getElementById('depth');
const swatchesEl = document.getElementById('swatches');
const outfitSwatchesEl = document.getElementById('outfitSwatches');
const makeupList = document.getElementById('makeupList');
const faceShapeEl = document.getElementById('faceShape');
const shapeTip = document.getElementById('shapeTip');
const pdfLogoImg = document.getElementById('pdfLogo');

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = await loadImage(URL.createObjectURL(file));
  drawPreview(img);
  analyzeImage(img);
});

// load image helper
function loadImage(src) {
  return new Promise((res) => {
    const i = new Image();
    i.crossOrigin = "Anonymous";
    i.onload = () => res(i);
    i.src = src;
  });
}

// draw centered
function drawPreview(img) {
  preview.width = 640; preview.height = 640;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0,0,preview.width,preview.height);
  const scale = Math.min(preview.width / img.width, preview.height / img.height);
  const w = img.width * scale; const h = img.height * scale;
  const x = (preview.width - w)/2; const y = (preview.height - h)/2;
  ctx.drawImage(img, x, y, w, h);
}

// get average color of patch with basic skin-like filter
function samplePatch(cx, cy, pw=0.12) {
  const W = preview.width, H = preview.height;
  const size = Math.floor(Math.min(W,H) * pw);
  const x = Math.max(0, Math.floor(cx*W - size/2));
  const y = Math.max(0, Math.floor(cy*H - size/2));
  const imgd = ctx.getImageData(x, y, size, size).data;
  let sum=[0,0,0], cnt=0;
  for (let i=0;i<imgd.length;i+=4){
    const r=imgd[i], g=imgd[i+1], b=imgd[i+2];
    if (r>12 && g>12 && b>12 && r<245 && g<245 && b<245){
      // basic skin-like filter
      sum[0]+=r; sum[1]+=g; sum[2]+=b; cnt++;
    }
  }
  if (cnt===0) return [190,170,150];
  return [Math.round(sum[0]/cnt), Math.round(sum[1]/cnt), Math.round(sum[2]/cnt)];
}

function rgbToLuminance(rgb){ return 0.2126*rgb[0] + 0.7152*rgb[1] + 0.0722*rgb[2]; }

function stdev(arr){
  const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
  const v = Math.sqrt(arr.reduce((s,x)=>s+(x-mean)**2,0)/arr.length);
  return v;
}

function explainUndertone(ut){
  if (ut==="Warm") return "Warm undertone: your cheek shows stronger red/yellow tones vs neck. Gold jewellery and warm colours suit you.";
  if (ut==="Cool") return "Cool undertone: skin shows cooler blue/pink signals vs neck. Silver jewellery and cool colours suit you.";
  return "Neutral: balanced tones. Both gold and silver can work; choose approachable mid-tones.";
}

function getPatchPixels(cx, cy, pw=0.12){
  const W = preview.width, H = preview.height;
  const size = Math.floor(Math.min(W,H) * pw);
  const x = Math.max(0, Math.floor(cx*W - size/2));
  const y = Math.max(0, Math.floor(cy*H - size/2));
  const imgd = ctx.getImageData(x, y, size, size).data;
  const arr = [];
  for (let i=0;i<imgd.length;i+=4){
    const r=imgd[i], g=imgd[i+1], b=imgd[i+2];
    if (r>10 && g>10 && b>10 && r<250 && g<250 && b<250){
      arr.push([r,g,b]);
    }
  }
  return arr.length?arr:[[200,180,160]];
}

// simple face shape guess by skin mask bounding box
function guessFaceShape(){
  const W = preview.width, H = preview.height;
  const centerPatch = getPatchPixels(0.5,0.4,0.28);
  const avg = centerPatch.reduce((acc,p)=>[acc[0]+p[0],acc[1]+p[1],acc[2]+p[2]],[0,0,0]).map(v=>v/centerPatch.length);
  const imgd = ctx.getImageData(0,0,W,H).data;
  let minX=W, minY=H, maxX=0, maxY=0;
  for(let y=0;y<H;y+=6){
    for(let x=0;x<W;x+=6){
      const i = (y*W + x)*4;
      const r=imgd[i], g=imgd[i+1], b=imgd[i+2];
      const dist = Math.sqrt((r-avg[0])**2 + (g-avg[1])**2 + (b-avg[2])**2);
      if(dist < 45){
        minX = Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y);
      }
    }
  }
  if(maxX<=minX || maxY<=minY) return {name:"Unknown", tip:"Try a clearer front selfie showing neck and hairline."};
  const w = maxX-minX; const h = maxY-minY;
  const ratio = w / h;
  if (ratio > 0.95) return {name:"Round", tip:"Try soft layers and side-swept bangs."};
  if (ratio > 0.78) return {name:"Oval", tip:"Most styles suit oval faces — try long waves."};
  if (ratio > 0.65) return {name:"Heart", tip:"Side-parted styles and chin-length layers balance a heart shape."};
  return {name:"Long / Square", tip:"Soft waves or choppy layers reduce angular look."};
}

// curated palettes
function buildPalette(ut, depth){
  const palettes = {
    Warm: {
      Light: ["#FFEFD5","#FFD1A9","#FFC18E","#FFB199","#F4A460","#D08B5B"],
      Medium: ["#FFDAB3","#FFB27A","#E87A3B","#D9693A","#C7623A","#A84C2E"],
      Deep: ["#A0522D","#8B3A2F","#7C2F2F","#5C221A","#4B1A0F","#3E1A0D"]
    },
    Cool: {
      Light: ["#E6F0FF","#CFE3FF","#BFD6FF","#B3D1FF","#9CC7FF","#7FB7FF"],
      Medium: ["#9ECFFF","#7FBFFF","#5FAFFF","#4B98E6","#3B7FBF","#2F5F9C"],
      Deep: ["#24476A","#203A55","#192B40","#112232","#0C1B2A","#08141D"]
    },
    Neutral: {
      Light: ["#F5EBDD","#EADFD1","#E0D6CA","#D6CFC3","#C8BFB2","#BFAF9E"],
      Medium: ["#D7C4AE","#C6A98F","#B99176","#9F6F56","#8B5A46","#754634"],
      Deep: ["#553227","#43231A","#331714","#27120E","#1C0E0A","#150A07"]
    }
  };
  return (palettes[ut] && palettes[ut][depth]) || palettes["Neutral"]["Medium"];
}

function makeupSuggestions(ut, depth){
  const data = {
    Warm: {
      Light: {lip:["Peach coral","#FFAB7A"],blush:"#FFB3A7",eyeliner:"Brown"},
      Medium:{lip:["Warm rose","#D96F61"],blush:"#E58A76",eyeliner:"Brown"},
      Deep:{lip:["Brick red","#8F2B2B"],blush:"#AC4B3C",eyeliner:"Deep brown"}
    },
    Cool: {
      Light:{lip:["Soft pink","#F7CFE2"],blush:"#F3B7D5",eyeliner:"Grey"},
      Medium:{lip:["Rosy pink","#D66E9A"],blush:"#D97BA6",eyeliner:"Brown or black"},
      Deep:{lip:["Berry","#8B2C57"],blush:"#8A3B57",eyeliner:"Black"}
    },
    Neutral:{
      Light:{lip:["Nude pink","#E6B7A9"],blush:"#E0AFA0",eyeliner:"Brown"},
      Medium:{lip:["Balanced rose","#C6786B"],blush:"#C57A6D",eyeliner:"Brown"},
      Deep:{lip:["Muted berry","#7F3E3E"],blush:"#7D4D4B",eyeliner:"Black"}
    }
  };
  return (data[ut] && data[ut][depth]) || data["Neutral"]["Medium"];
}

function outfitSuggestions(ut){
  const map = {
    Warm: ["#FFD1A9","#E7A977","#C97A3A"],
    Cool: ["#BFE0FF","#7FBFFF","#3B7FBF"],
    Neutral: ["#D7C4AE","#A88B6B","#7A5A3F"]
  };
  return (map[ut]||map["Neutral"]).slice(0,3);
}

// main analyze function
function analyzeImage(){
  results.classList.remove('hidden');

  const cheek = samplePatch(0.5,0.40,0.14);
  const neck = samplePatch(0.5,0.78,0.16);

  const cheekRB = cheek[0] - cheek[2];
  const neckRB = neck[0] - neck[2];
  const delta = cheekRB - neckRB;

  let undertone = "Neutral";
  if (delta > 12) undertone = "Warm";
  else if (delta < -12) undertone = "Cool";

  const lumCheek = rgbToLuminance(cheek);
  let depth = "Medium";
  if (lumCheek > 160) depth = "Light";
  else if (lumCheek < 95) depth = "Deep";

  const pixels = getPatchPixels(0.5,0.40,0.14);
  const lumArr = pixels.map(p => rgbToLuminance(p));
  const contrast = stdev(lumArr);
  const brightsoft = contrast > 28 ? "Bright" : "Soft";

  const shape = guessFaceShape();

  undertoneEl.textContent = undertone;
  undertoneExpl.textContent = explainUndertone(undertone);
  brightsoftEl.textContent = brightsoft;
  depthEl.textContent = depth;
  faceShapeEl.textContent = shape.name;
  shapeTip.textContent = shape.tip;

  const palette = buildPalette(undertone, depth);
  renderSwatches(palette);

  const makeup = makeupSuggestions(undertone, depth);
  renderMakeup(makeup);

  const outfit = outfitSuggestions(undertone);
  renderSwatches(outfit, outfitSwatchesEl);
}

// render swatches
function renderSwatches(arr, container=swatchesEl){
  container.innerHTML="";
  arr.forEach(hex=>{
    const d = document.createElement('div');
    d.className='swatch';
    d.style.background = hex;
    d.textContent = '';
    container.appendChild(d);
  });
}

// render makeup
function renderMakeup(data){
  makeupList.innerHTML="";
  const li1 = document.createElement('li');
  li1.innerHTML = `<strong>Lipstick:</strong> ${data.lip[0]} <span style="background:${data.lip[1]};display:inline-block;width:18px;height:12px;border-radius:4px;margin-left:8px;vertical-align:middle"></span>`;
  const li2 = document.createElement('li');
  li2.innerHTML = `<strong>Blush:</strong> ${data.blush} <span style="background:${data.blush};display:inline-block;width:18px;height:12px;border-radius:4px;margin-left:8px;vertical-align:middle"></span>`;
  const li3 = document.createElement('li');
  li3.innerHTML = `<strong>Eyeliner:</strong> ${data.eyeliner}`;
  makeupList.appendChild(li1); makeupList.appendChild(li2); makeupList.appendChild(li3);
}

// attach analyze on file load
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const img = await loadImage(URL.createObjectURL(file));
  drawPreview(img);
  analyzeImage(img);
});

// ---------------- PDF generation --------------
document.getElementById("downloadPDF").addEventListener("click", async () => {
  const { jsPDF } = window.jspdf;

  // capture small preview as thumbnail
  const thumbnailCanvas = document.createElement('canvas');
  thumbnailCanvas.width = 300;
  thumbnailCanvas.height = 300;
  const tctx = thumbnailCanvas.getContext('2d');
  tctx.fillStyle = "#fff";
  tctx.fillRect(0,0,thumbnailCanvas.width,thumbnailCanvas.height);
  tctx.drawImage(preview, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
  const thumbnailData = thumbnailCanvas.toDataURL("image/png");

  // logo to dataURL (if present)
  let logoData = null;
  if (pdfLogoImg && pdfLogoImg.complete && pdfLogoImg.naturalWidth>0){
    const c = document.createElement('canvas');
    c.width = pdfLogoImg.naturalWidth;
    c.height = pdfLogoImg.naturalHeight;
    const cc = c.getContext('2d');
    cc.fillStyle="#ffffff";
    cc.fillRect(0,0,c.width,c.height);
    cc.drawImage(pdfLogoImg,0,0);
    logoData = c.toDataURL("image/png");
  }

  const doc = new jsPDF({ unit:'mm', format:'a4', compress:true });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 12;

  // add logo
  if (logoData){
    const imgProps = doc.getImageProperties(logoData);
    const w = 40;
    const h = (imgProps.height * w) / imgProps.width;
    doc.addImage(logoData, 'PNG', 12, y, w, h);
  }

  // title
  doc.setFontSize(18);
  doc.setTextColor(40,40,60);
  doc.text("Haneul Palette — Analysis Report", pageWidth/2, y+10, { align:'center' });

  y += 28;

  // user thumbnail
  doc.addImage(thumbnailData, 'PNG', 12, y, 40, 40);

  // summary text
  doc.setFontSize(12);
  doc.text(`Undertone: ${undertoneEl.textContent}`, 60, y + 8);
  doc.text(`Brightness: ${brightsoftEl.textContent}`, 60, y + 18);
  doc.text(`Depth: ${depthEl.textContent}`, 60, y + 28);
  doc.text(`Face Shape: ${faceShapeEl.textContent}`, 60, y + 38);

  y += 50;

  // swatches (starter palette)
  doc.setFontSize(13);
  doc.text("Starter Colour Palette:", 12, y);
  let sx = 12;
  y += 6;
  const paletteChildren = Array.from(document.querySelectorAll('#swatches .swatch')).map(s => s.style.background || '#ccc');
  paletteChildren.forEach((hex, i) => {
    doc.setFillColor(hex);
    doc.rect(sx, y, 18, 18, 'F');
    doc.setDrawColor(220);
    doc.rect(sx, y, 18, 18, 'S');
    sx += 22;
  });
  y += 26;

  // outfit colours
  doc.text("Top Outfit Colours:", 12, y);
  let ox = 12;
  y += 6;
  const outfitChildren = Array.from(document.querySelectorAll('#outfitSwatches .swatch')).map(s => s.style.background || '#ddd');
  outfitChildren.forEach(hex => {
    doc.setFillColor(hex); doc.rect(ox, y, 14, 14, 'F'); ox += 18;
  });
  y += 22;

  // makeup suggestions
  doc.setFontSize(13);
  doc.text("Makeup Suggestions:", 12, y);
  y += 6;
  const makeupItems = Array.from(makeupList.querySelectorAll('li')).map(li => li.textContent);
  doc.setFontSize(11);
  makeupItems.forEach((m, idx) => {
    doc.text(`• ${m}`, 14, y); y += 6;
  });

  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Note: This is an automated estimation. For a professional 16-season analysis, consult an in-person Korean color specialist.", 12, y, {maxWidth: pageWidth-24});

  // final save
  const name = `Haneul_Palette_Analysis.pdf`;
  doc.save(name);
});
