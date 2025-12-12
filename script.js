// script.js - Haneul Palette basic client-side analysis

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

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = await loadImage(URL.createObjectURL(file));
  drawPreview(img);
  analyzeImage(img);
});

function loadImage(src) {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.src = src;
  });
}

function drawPreview(img) {
  // draw centered into square canvas
  const size = Math.max(img.width, img.height);
  preview.width = 640; preview.height = 640;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0,0,preview.width,preview.height);
  // scale and center
  const scale = Math.min(preview.width / img.width, preview.height / img.height);
  const w = img.width * scale; const h = img.height * scale;
  const x = (preview.width - w)/2; const y = (preview.height - h)/2;
  ctx.drawImage(img, x, y, w, h);
}

function samplePatch(cx, cy, pw=0.12) {
  // sample square patch around relative center (cx,cy) in preview coords
  const W = preview.width, H = preview.height;
  const size = Math.floor(Math.min(W,H) * pw);
  const x = Math.max(0, Math.floor(cx*W - size/2));
  const y = Math.max(0, Math.floor(cy*H - size/2));
  const imgd = ctx.getImageData(x, y, size, size).data;
  // average only skin-like pixels (filter extremes)
  let sum=[0,0,0], cnt=0;
  for (let i=0;i<imgd.length;i+=4){
    const r=imgd[i], g=imgd[i+1], b=imgd[i+2];
    if (r>15 && g>15 && b>15 && r<250 && g<250 && b<250){
      sum[0]+=r; sum[1]+=g; sum[2]+=b; cnt++;
    }
  }
  if (cnt===0) return [sum[0]/1,sum[1]/1,sum[2]/1];
  return [sum[0]/cnt, sum[1]/cnt, sum[2]/cnt];
}

function rgbToLuminance(rgb){
  // simple luminance
  return 0.2126*rgb[0] + 0.7152*rgb[1] + 0.0722*rgb[2];
}

function stdev(arr){
  const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
  const v = Math.sqrt(arr.reduce((s,x)=>s+(x-mean)**2,0)/arr.length);
  return v;
}

function explainUndertone(ut){
  if (ut==="Warm") return "Warm undertone: your cheek shows stronger red/yellow tones vs neck. Gold jewellery and warm colours suit you.";
  if (ut==="Cool") return "Cool undertone: skin has cooler blue/pink signals vs neck. Silver jewellery and cool colours suit you.";
  return "Neutral: mix of warm and cool. You can wear both gold and silver; balanced colour palette recommended.";
}

function analyzeImage(img){
  // assume preview already has the image drawn
  results.classList.remove('hidden');

  // sample relative positions: cheek area ~ (0.5, 0.4), neck area ~ (0.5, 0.78)
  const cheek = samplePatch(0.5, 0.40, 0.14);
  const neck = samplePatch(0.5, 0.78, 0.16);

  // undertone: compare (cheek R - cheek B) and cheek-neck difference
  const cheekRB = cheek[0] - cheek[2];
  const neckRB = neck[0] - neck[2];
  const delta = cheekRB - neckRB; // positive => warm, negative => cool

  let undertone = "Neutral";
  if (delta > 12) undertone = "Warm";
  else if (delta < -12) undertone = "Cool";

  // brightness / depth
  const lumCheek = rgbToLuminance(cheek);
  let depth = "Medium";
  if (lumCheek > 160) depth = "Light";
  else if (lumCheek < 95) depth = "Deep";

  // bright/soft: contrast measure inside cheek patch
  const pixels = getPatchPixels(0.5,0.40,0.14);
  const lumArr = pixels.map(p => rgbToLuminance(p));
  const contrast = stdev(lumArr);
  const brightsoft = contrast > 28 ? "Bright" : "Soft";

  // face-shape guess: compute skin-mask bounding box ratio
  const shape = guessFaceShape();

  // show results
  undertoneEl.textContent = undertone;
  undertoneExpl.textContent = explainUndertone(undertone);
  brightsoftEl.textContent = brightsoft;
  depthEl.textContent = depth;
  faceShapeEl.textContent = shape.name;
  shapeTip.textContent = shape.tip;

  // produce swatches
  const palette = buildPalette(undertone, depth, brightsoft);
  renderSwatches(palette);

  // makeup suggestions
  const makeup = makeupSuggestions(undertone, depth);
  renderMakeup(makeup);

  // outfit top colours
  const outfit = outfitSuggestions(undertone, depth);
  renderSwatches(outfit, outfitSwatchesEl);
}

// helper to read all pixels in patch
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

function buildPalette(ut, depth, brightsoft){
  // simple curated swatches for each undertone x depth
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
  const chosen = (palettes[ut] && palettes[ut][depth]) || palettes["Neutral"]["Medium"];
  return chosen.slice(0,6);
}

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

function makeupSuggestions(ut, depth){
  const data = {
    Warm: {
      Light: {lip:["peach coral","#FFAB7A"],blush:"#FFB3A7",eyeliner:"brown"},
      Medium:{lip:["warm rose","#D96F61"],blush:"#E58A76",eyeliner:"brown"},
      Deep:{lip:["brick red","#8F2B2B"],blush:"#AC4B3C",eyeliner:"deep brown"}
    },
    Cool: {
      Light:{lip:["soft pink","#F7CFE2"],blush:"#F3B7D5",eyeliner:"grey"},
      Medium:{lip:["rosy pink","#D66E9A"],blush:"#D97BA6",eyeliner:"brown or black"},
      Deep:{lip:["berry","#8B2C57"],blush:"#8A3B57",eyeliner:"black"}
    },
    Neutral:{
      Light:{lip:["nude pink","#E6B7A9"],blush:"#E0AFA0",eyeliner:"brown"},
      Medium:{lip:["balanced rose","#C6786B"],blush:"#C57A6D",eyeliner:"brown"},
      Deep:{lip:["muted berry","#7F3E3E"],blush:"#7D4D4B",eyeliner:"black"}
    }
  };
  return (data[ut] && data[ut][depth]) || data["Neutral"]["Medium"];
}

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

function outfitSuggestions(ut, depth){
  // pick 3 clothing-friendly hexes based on undertone
  const map = {
    Warm: ["#FFD1A9","#E7A977","#C97A3A"],
    Cool: ["#BFE0FF","#7FBFFF","#3B7FBF"],
    Neutral: ["#D7C4AE","#A88B6B","#7A5A3F"]
  };
  return (map[ut]||map["Neutral"]).slice(0,3);
}

// face shape guess via quick skin mask bounding box
function guessFaceShape(){
  const W = preview.width, H = preview.height;
  // make skin mask by sampling center area and thresholding by distance to cheek color
  const centerPatch = getPatchPixels(0.5,0.4,0.28);
  const avg = centerPatch.reduce((acc,p)=>[acc[0]+p[0],acc[1]+p[1],acc[2]+p[2]],[0,0,0]).map(v=>v/centerPatch.length);
  const imgd = ctx.getImageData(0,0,W,H).data;
  let minX=W, minY=H, maxX=0, maxY=0;
  for(let y=0;y<H;y+=4){
    for(let x=0;x<W;x+=4){
      const i = (y*W + x)*4;
      const r=imgd[i], g=imgd[i+1], b=imgd[i+2];
      const dist = Math.sqrt((r-avg[0])**2 + (g-avg[1])**2 + (b-avg[2])**2);
      if(dist < 45){ // skin-like
        minX = Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y);
      }
    }
  }
  if(maxX<=minX || maxY<=minY){
    return {name:"Unknown", tip:"Try a clearer front-facing photo showing neck and hairline."};
  }
  const w = maxX-minX; const h = maxY-minY;
  const ratio = w / h; // wider => round, narrow => oval/tall
  // heuristic mapping
  if (ratio > 0.95) {
    return {name:"Round", tip:"Soft layers and side-swept bangs add length to the face."};
  } else if (ratio > 0.78) {
    return {name:"Oval", tip:"Most styles suit oval faces — try long waves or blunt bob."};
  } else if (ratio > 0.65) {
    return {name:"Heart", tip:"Side-parted styles and chin-length layers balance a heart shape."};
  } else {
    return {name:"Long / Square", tip:"Soft waves or choppy layers reduce the angular look."};
  }
}
