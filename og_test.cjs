const { ImageResponse } = require('next/og');
const fs = require('node:fs');
(async () => {
  try {
    const res = new ImageResponse(
      { type:'div', props:{ style:{ display:'flex', width:'100%', height:'100%', background:'#0a0a0c', alignItems:'center', justifyContent:'center' },
        children:{ type:'span', props:{ style:{ fontSize:120, fontWeight:800, color:'#fff' }, children:'8.5 / 10 otonofu reviews' } } } },
      { width: 1200, height: 630 }
    );
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync('og_test.png', buf);
    console.log('OK bytes=', buf.length);
  } catch (e) { console.log('ERR', e && e.message); }
})();
