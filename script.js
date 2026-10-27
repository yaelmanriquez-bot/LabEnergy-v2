// ===== LabEnergy — script.js =====
// ATAJO Y CONSTANTES: $(id) obtiene un elemento de la página por su id; EF = factor de emisión (kg CO₂ por kWh);
// KID = eficacia luminosa ideal de la luz blanca (250 lm/W), base para calcular la eficiencia η.
const $=id=>document.getElementById(id),EF=0.4,KID=250;
// ---------- 1. MODELO FÍSICO DE LAS CARGAS ----------
// Cada carga define: I(v) = corriente [A] según el voltaje v [V]; K = eficacia luminosa [lm/W]; E = eficiencia mecánica (solo motor).
// Incandescente: la resistencia AUMENTA con el voltaje (filamento más caliente): R(V) = 14,5·(V/12)^0,2 Ω, y I = V/R.
const LD={inc:{n:'Incandescente',I:v=>v>0?v/(14.5*Math.pow(v/12,.2)):0,K:v=>11*Math.pow(v/12,1.2)},
// LED: no conduce bajo 9 V (umbral); sobre 9 V la corriente crece linealmente. K ≈ 100 lm/W y baja un poco si P > 2 W.
led:{n:'Módulo LED',I:v=>v>9?.055*(v-9):0,K:(v,p)=>Math.max(0,100-3*Math.max(0,p-2))},
// Resistencia pura (carga de control): Ley de Ohm, I = V/10. K = 0 porque toda la potencia se convierte en calor.
res:{n:'Resistencia 10 Ω',I:v=>v/10,K:()=>0},mot:{n:'Motor DC',I:v=>.035*v,E:v=>Math.max(0,.62-.01*Math.abs(v-12))},
// Circuito abierto: no circula corriente.
off:{n:'Circuito abierto',I:()=>0,K:()=>0}};
// Colores de cada carga en los gráficos.
const COL={inc:'#d97706',led:'#0e9aa7',res:'#7b82a6',mot:'#c0392b'};
// ---------- 2. GENERADOR DE RUIDO REPRODUCIBLE ----------
// rng32(semilla) devuelve una función que entrega números pseudoaleatorios entre 0 y 1.
// Con la misma semilla se obtiene siempre la misma secuencia (reproducibilidad).
function rng32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// ---------- 3. ESTADO DE LA APLICACIÓN ----------
// rnd: generador de ruido · run: ensayo en marcha · timer: temporizador · t: segundos transcurridos
// rec: puntos registrados · hist: historial en vivo · NZ: amplitud del ruido (0,01 = ±1 %)
let rnd,run=false,timer=null,t=0,rec=[],hist=[],NZ=.01;
// ---------- 4. MOTOR DE DATOS ----------
// meas(carga, voltaje, generador) realiza UNA medición simulada:
//   1) I = I_modelo(V)·(1 + ruido)   2) P = V·I   3) R = V/I   4) K = eficacia   5) lm = K·P   6) η = K/250·100 (o η del motor)
// Devuelve: k (carga), v, i (mA), p (W), r (Ω), K, lm y eta (%).
function meas(k,v,r){const L=LD[k],I=Math.max(0,L.I(v)*(1+(r()-.5)*2*NZ)),P=v*I,K=L.K?L.K(v,P):0,lm=K*P,eta=P>0?(L.E?L.E(v)*100:K/KID*100):0;return{k,v,i:I*1000,p:P,r:I>0?v/I:0,K,lm,eta}}
// Reinicia el generador de ruido con la semilla escrita por el usuario y la muestra en el encabezado.
function setSeed(){rnd=rng32(+$('seed').value||1);$('seedTag').textContent=$('seed').value}
// Muestra una medición en los indicadores (I, P, R, lm, K, η) y actualiza el circuito virtual.
function show(m){viz(m);$('mI').textContent=m.i.toFixed(0)+' mA';$('mP').textContent=m.p.toFixed(2)+' W';$('mR').textContent=m.i>0?m.r.toFixed(1)+' Ω':'∞ Ω';$('mL').textContent=m.lm.toFixed(0)+' lm';$('mK').textContent=m.K.toFixed(1)+' lm/W';$('mE').textContent=m.eta.toFixed(1)+' %'}
// Toma una medición con la carga y el voltaje elegidos en pantalla.
function cur(){return meas($('load').value,+$('volt').value,rnd)}
// Se ejecuta al mover el voltaje, cambiar la carga o el ruido: actualiza el texto del voltaje y los indicadores.
function refresh(fromAmp){const L=LD[$('load').value],v=+$('volt').value;$('vt').textContent=v.toFixed(1)+' V';
 // El control de corriente se ajusta al máximo que la carga permite a 15 V y sigue al voltaje (salvo que el usuario lo esté moviendo).
 $('amp').max=Math.max(1,Math.round(L.I(15)*1000));if(fromAmp!==true)$('amp').value=L.I(v)*1000;$('at').textContent=(L.I(v)*1000).toFixed(0)+' mA';
 delta();show(cur());updCurve()}
// Un paso del ensayo (cada 0,5 s): mide, muestra y agrega la potencia al gráfico en vivo (ventana de 40 puntos).
function tick(){t+=.5;const m=cur();show(m);hist.push({t,...m});live.data.labels.push(t.toFixed(1));live.data.datasets[0].data.push(m.p);if(live.data.labels.length>40){live.data.labels.shift();live.data.datasets[0].data.shift()}live.update('none')}
// Botón Iniciar/Pausar: activa o detiene el temporizador de 0,5 s que llama a tick().
function toggleRun(){run=!run;$('run').textContent=run?'⏹ Pausar ensayo':'▶ Iniciar ensayo';if(run)timer=setInterval(tick,500);else clearInterval(timer)}
// Registra el punto actual (o uno dado) en la tabla de resultados.
function addRec(src,m){m=m||cur();m.src=src;rec.push(m);render()}
// Barrido automático: mide las 4 cargas a 6, 8, 10, 12 y 14 V con la misma semilla (resultados idénticos cada vez) y abre Resultados.
function sweep(){const r=rng32(+$('seed').value||1);rec=rec.filter(x=>x.src!=='barrido');['inc','led','res','mot'].forEach(k=>[6,8,10,12,14].forEach(v=>{const m=meas(k,v,r);m.src='barrido';rec.push(m)}));render();go('res')}
// Limpiar: borra los datos registrados y el gráfico en vivo, y reinicia el ruido.
function clearAll(){rec=[];hist=[];t=0;live.data.labels=[];live.data.datasets[0].data=[];live.update();setSeed();render()}
// ---------- 5. CIRCUITO VIRTUAL ----------
// viz(m): ajusta el brillo de la carga (según lm; resistencia = calor; motor = gris), los valores de los instrumentos
// y la velocidad de los puntos de corriente (más rápida si I es mayor).
function viz(m){$('why').innerHTML=explain(m);
 // Barra «¿a dónde va la energía?»: parte útil (luz/movimiento) frente a calor.
 {const u=m.p>0?Math.min(100,m.eta):0,mot=m.k==='mot';$('spU').style.width=u+'%';$('spH').style.width=(m.p>0?100-u:100)+'%';
  $('spU').textContent=u>=12?(mot?'⚙️ Movimiento ':'💡 Luz ')+u.toFixed(0)+' %':'';$('spH').textContent=m.p>0?'🔥 Calor '+(100-u).toFixed(0)+' %':'Sin consumo';
  // Rotor del motor: gira más rápido cuanto mayor es la corriente.
  const ro=$('rotor');ro.style.display=mot&&m.i>0?'block':'none';ro.style.animationDuration=Math.max(.12,Math.min(3,.2/((m.i/1000)||1)))+'s'}const L=m.k,g=L==='res'?Math.min(1,m.p/15):L==='mot'?.35:Math.min(1,m.lm/300),c=L==='res'?'#d13438':L==='mot'?'#7b82a6':'#ffc83d',o=L==='off';
 // Ilustración de la carga: muestra la imagen activa, su brillo o calor (--g) y gira el motor según la corriente.
 {document.querySelectorAll('#circ .sym').forEach(e=>e.style.display=e.dataset.k===L?'block':'none');document.querySelectorAll('#ill .ill').forEach(e=>e.classList.toggle('on',e.dataset.k===L));$('ill').style.setProperty('--g',o?0:g);$('illCap').textContent=CAP[L];
  const fn=document.querySelector('#ill .fan');if(fn){fn.style.animationDuration=Math.max(.12,Math.min(3,.2/((m.i/1000)||1)))+'s';fn.style.animationPlayState=m.i>0?'running':'paused'}}
 $('bulb').setAttribute('fill',c);$('bulb').setAttribute('fill-opacity',o?0:.15+.85*g);$('halo').setAttribute('fill',c);$('halo').setAttribute('fill-opacity',o?0:g*.45);
 $('am').textContent=m.i.toFixed(0)+' mA';$('vm').textContent=m.v.toFixed(1)+' V';$('src').textContent=m.v.toFixed(1)+' V';$('ldn').textContent=LD[L].n;
 const f=$('flow'),A=m.i/1000;f.style.opacity=A>0?1:0;f.style.animationDuration=Math.max(.25,Math.min(4,.35/(A||1)))+'s'}
// explain(m): mensaje breve que describe el fenómeno según la carga y el voltaje actuales.
function explain(m){
  const v=m.v,L=m.k;
  if(L==='off') return '🔌 <b>Circuito abierto:</b> no hay un camino cerrado, así que no circula corriente (I = 0) aunque la fuente tenga '+v.toFixed(1)+' V. Sin corriente no hay potencia.';
  if(v===0) return '⚡ <b>Fuente apagada (0 V):</b> sin voltaje no hay corriente. ¡Prueba subiéndolo!';
  if(L==='led'){
    if(v<=9) return '💡 <b>El voltaje es muy bajo para encender el módulo LED.</b> Sus 3 LED en serie necesitan sumar ≈ 9 V para conducir. ¡Prueba subiéndolo!';
    if(v<10.5) return '💡 <b>¡Ya conduce!</b> Superaste el umbral de ≈ 9 V y el LED empieza a brillar débilmente. Sigue subiendo.';
    return '💡 <b>El LED convierte la energía directamente en luz</b> (η ≈ '+m.eta.toFixed(0)+' %) con solo '+m.p.toFixed(1)+' W. Compara con la incandescente: misma luz con mucha menos energía.';
  }
  if(L==='inc'){
    if(v<4) return '🔥 <b>Voltaje bajo:</b> el filamento apenas se calienta y casi no emite luz. Sube el voltaje para que se ponga incandescente.';
    return '🔥 <b>El filamento se calienta y brilla</b>, pero solo ≈ '+m.eta.toFixed(0)+' % de la energía se convierte en luz; el resto es calor. Su resistencia aumenta con la temperatura ('+m.r.toFixed(1)+' Ω).';
  }
  if(L==='res') return '🌡️ <b>La resistencia no produce luz:</b> toda la potencia ('+m.p.toFixed(1)+' W) se convierte en calor. Si duplicas el voltaje, la potencia se cuadruplica (P = V²/R).';
  if(L==='mot'){
    if(v<2) return '⚙️ <b>Voltaje muy bajo:</b> la corriente es pequeña y el motor no tiene fuerza para girar. ¡Prueba subiéndolo!';
    return '⚙️ <b>La corriente se convierte en movimiento</b> (η ≈ '+m.eta.toFixed(0)+' %). El resto se pierde como calor y roce.';
  }
  return '';
}
// ---------- 6. EXPERIMENTO Y EXPLICACIÓN ----------
// repeat10(): toma 10 lecturas de corriente y calcula la media y la desviación estándar (σ) para mostrar el efecto del ruido.
function repeat10(){const r=rng32(+$('seed').value||1),k=$('load').value,v=+$('volt').value,a=Array.from({length:10},()=>meas(k,v,r).i),m=a.reduce((x,y)=>x+y,0)/10,sd=Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/9);
 $('rep').innerHTML=`10 lecturas de I (mA): ${a.map(x=>x.toFixed(1)).join(' · ')}<br>Media <b>${m.toFixed(1)}</b> mA · desviación σ = <b>${sd.toFixed(2)}</b> mA (${m?(sd/m*100).toFixed(2):0} %). Suba el ruido y repita para ver cómo crece la dispersión.`}
// ---------- 7. RESULTADOS Y PROYECCIÓN ----------
// avgAt12(carga, magnitud): promedio de los puntos registrados a 12 V; si no hay, usa el modelo sin ruido (m=0 indica que viene del modelo).
function avgAt12(k,f){const a=rec.filter(x=>x.k===k&&x.v===12);return a.length?{v:a.reduce((s,x)=>s+x[f],0)/a.length,m:1}:{v:(()=>{const m=meas(k,12,()=>.5);return m[f]})(),m:0}}
// render(): redibuja la tabla de datos, las curvas I–V y η–V, y verifica la hipótesis H1 (razón K_LED / K_incandescente ≥ 5).
function render(){$('tb').innerHTML=rec.length?rec.map(x=>`<tr><td>${LD[x.k].n}</td><td class=n>${x.v}</td><td class=n>${x.i.toFixed(0)}</td><td class=n>${x.p.toFixed(2)}</td><td class=n>${x.i>0?x.r.toFixed(1):'∞'}</td><td class=n>${x.lm.toFixed(0)}</td><td class=n>${x.K.toFixed(1)}</td><td class=n>${x.eta.toFixed(1)}</td></tr>`).join(''):'<tr><td colspan=8 class=dim>Sin datos. Use «Registrar punto» o «Barrido automático».</td></tr>';
 ['cIV','cEta'].forEach((id,j)=>{const c=id==='cIV'?civ:ceta;c.data.datasets=Object.keys(COL).filter(k=>j==0||k!=='res').map(k=>({label:LD[k].n,borderColor:COL[k],backgroundColor:COL[k],tension:.2,data:rec.filter(x=>x.k===k).sort((a,b)=>a.v-b.v).map(x=>({x:x.v,y:j?x.eta:x.i}))}));c.update()});
 const a=avgAt12('inc','K'),b=avgAt12('led','K'),z=avgAt12('res','eta'),ratio=b.v/a.v;
 $('h1').innerHTML=`K incandescente = <b>${a.v.toFixed(1)}</b> lm/W · K LED = <b>${b.v.toFixed(1)}</b> lm/W · razón = <b class="m">${ratio.toFixed(1)}×</b> · η resistencia = ${z.v.toFixed(1)} %<br>H1 <b class="${ratio>=5&&z.v===0?'ok':'bad'}">${ratio>=5&&z.v===0?'se cumple':'no se cumple'}</b> con ${a.m&&b.m?'datos registrados a 12 V':'valores del modelo (registre puntos a 12 V para usar sus datos)'}.`;effRes()}
// effRes(): conclusión de EFICIENCIA (a 12 V) y ranking de cargas por η, con datos registrados o, si no hay, con el modelo.
function effRes(){const g=(k,f)=>avgAt12(k,f),Ki=g('inc','K'),Kl=g('led','K'),Ei=g('inc','eta'),El=g('led','eta'),Em=g('mot','eta'),Er=g('res','eta'),src=Ki.m&&Kl.m?'tus datos registrados':'el modelo (registra puntos a 12 V para usar tus datos)',ratio=Kl.v/Ki.v,save=(1-Ki.v/Kl.v)*100;
 $('effRes').innerHTML=`<h2>Conclusión de eficiencia (a 12 V)</h2><div class="kk"><div><small>Módulo LED</small><span class="big">${El.v.toFixed(0)} %</span><br>de la energía → luz</div><div><small>Incandescente</small><span class="big">${Ei.v.toFixed(1)} %</span><br>de la energía → luz</div><div><small>El LED es</small><span class="big">${ratio.toFixed(1)}×</span><br>más eficiente</div><div><small>Ahorro a igual luz</small><span class="big">${save.toFixed(0)} %</span><br>menos potencia</div></div>
 <p>Con ${src}: por cada 100 J de energía eléctrica, la lámpara incandescente pierde ≈ <b>${(100-Ei.v).toFixed(0)} J</b> como calor y el LED ≈ <b>${(100-El.v).toFixed(0)} J</b>. La resistencia de control tiene η = ${Er.v.toFixed(0)} % (toda su energía es calor) y el motor convierte ≈ <b>${Em.v.toFixed(0)} %</b> en movimiento.</p>
 <p><b>Conclusión:</b> ser más eficiente es producir la misma luz con menos energía. Para 800 lm, el LED necesita ≈ <b>${(800/Kl.v).toFixed(0)} W</b> y la incandescente ≈ <b>${(800/Ki.v).toFixed(0)} W</b>.</p>`;
 const L=[['led',El.v],['mot',Em.v],['inc',Ei.v],['res',Er.v]].sort((a,b)=>b[1]-a[1]),mx=Math.max(...L.map(x=>x[1]),1);
 $('rank').innerHTML=L.map(([k,v])=>`<div class="bar"><span>${LD[k].n}</span><div style="flex:1;background:#ece8f8;border-radius:8px"><i style="width:${Math.max(2,v/mx*100)}%"></i></div><em>${v.toFixed(1)} %</em></div>`).join('')}
// ---------- 8. NAVEGACIÓN Y EXPORTACIÓN ----------
// go(id): muestra la pestaña elegida y marca el botón activo del menú.
function go(id){document.querySelectorAll('.tab').forEach(e=>e.classList.toggle('on',e.id==='t-'+id));document.querySelectorAll('#nav button').forEach(e=>e.classList.toggle('on',e.dataset.t===id))}
// Crea los botones del menú de pestañas.
[['lab','🔬 Ensayo'],['ext','🔌 Circuito externo'],['guide','📖 Guía'],['theory','📚 Teoría'],['res','📊 Resultados'],['val','👥 Validación']].forEach(([i,n])=>{const b=document.createElement('button');b.textContent=n;b.dataset.t=i;b.onclick=()=>go(i);if(i==='lab')b.className='on';$('nav').append(b)});
// Llena el selector de carga con las opciones del modelo.
$('load').innerHTML=['inc','led','res','mot','off'].map(k=>`<option value=${k}>${LD[k].n}</option>`).join('');
// dl(): descarga un archivo CSV (usa la capacidad de descargas si la página está publicada como artifact; si no, descarga directa).
async function dl(name,txt){try{const d=window.claude&&await claude.use('downloads');if(d){await d.save({filename:name,data:txt});return}}catch(e){if(e&&e.code==='declined')return}
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/csv'}));a.download=name;a.click()}
// csv(): exporta los datos registrados (carga, V, I, P, R, lm, K, η, origen y semilla).
// Formato pensado para Excel en español: separador ";", decimales con coma y BOM UTF-8 (para ver bien tildes, Ω y η).
const fz=n=>String(n).replace('.',',');
const toCsv=(h,rows)=>'\uFEFF'+[h,...rows].map(r=>r.join(';')).join('\r\n');
function csv(){if(!rec.length)return alert('Aún no hay datos registrados.');
 // Ordena por tipo de carga y luego por voltaje, con encabezados y unidades claras.
 const ord=['inc','led','res','mot','off'],d=[...rec].sort((a,b)=>ord.indexOf(a.k)-ord.indexOf(b.k)||a.v-b.v);
 dl('labenergy_datos.csv',toCsv(['Carga','Tensión (V)','Corriente (mA)','Potencia (W)','Resistencia (Ω)','Flujo luminoso (lm)','Eficacia (lm/W)','Eficiencia η (%)','Origen','Semilla'],
  d.map(x=>[LD[x.k].n,fz(x.v),fz(x.i.toFixed(1)),fz(x.p.toFixed(2)),(x.i>0?fz(x.r.toFixed(1)):'∞'),fz(x.lm.toFixed(0)),fz(x.K.toFixed(1)),fz(x.eta.toFixed(1)),x.src,$('seed').value])))}
// ---------- 9. VALIDACIÓN DE USABILIDAD (SUS) ----------
// SURVEY_URL: dirección (termina en /exec) de un Google Apps Script que recibe cada respuesta y la guarda en una hoja de Google Sheets.
// Si está vacía, las respuestas solo se guardan en el navegador de quien responde. Las instrucciones para crearla están en el README.
const SURVEY_URL='https://script.google.com/macros/s/AKfy.../exec';
// Las 10 preguntas del cuestionario SUS (escala 1–5).
const SQ=['Creo que me gustaría usar este laboratorio con frecuencia.','Encontré el sistema innecesariamente complejo.','Pensé que el sistema era fácil de usar.','Creo que necesitaría ayuda de un técnico para usarlo.','Las funciones estaban bien integradas.','Hubo demasiada inconsistencia en el sistema.','Imagino que la mayoría aprendería a usarlo rápidamente.','Me pareció muy engorroso de usar.','Me sentí con mucha confianza usándolo.','Necesité aprender muchas cosas antes de usarlo.'];
// Dibuja las preguntas con sus opciones 1–5.
$('sus').innerHTML=SQ.map((q,i)=>`<label>${i+1}. ${q}</label><div class=o>${[1,2,3,4,5].map(v=>`<label><input type=radio name=q${i} value=${v}> ${v}</label>`).join('')}</div>`).join('')+'<p class=note>1 = totalmente en desacuerdo · 5 = totalmente de acuerdo</p>';
// Respuestas guardadas en este navegador (copia local, útil para pruebas).
let sus=[];try{sus=JSON.parse(localStorage.getItem('labenergy_sus')||'[]')}catch(e){}
function susMsg(t,c){$('susMsg').innerHTML='<span class="'+c+'">'+t+'</span>'}
// saveSus(): puntaje SUS = suma(impares: respuesta − 1; pares: 5 − respuesta) × 2,5 → escala 0–100. Guarda una copia local y envía la respuesta a SURVEY_URL.
async function saveSus(){const a=SQ.map((_,i)=>{const r=document.querySelector(`input[name=q${i}]:checked`);return r?+r.value:null});
 if(a.includes(null))return susMsg('Responde las 10 preguntas antes de enviar.','bad');
 const score=a.reduce((x,v,i)=>x+(i%2===0?v-1:5-v),0)*2.5;
 const rec={fecha:new Date().toISOString(),codigo:$('pid').value.trim()||'anónimo',perfil:$('prf').value,tarea_sin_ayuda:$('tsk').value};
 a.forEach((v,i)=>rec['p'+(i+1)]=v);rec.sus=score;rec.comentario=$('cmt').value.trim();
 sus.push(rec);try{localStorage.setItem('labenergy_sus',JSON.stringify(sus))}catch(e){}
 let sent=false;
 if(SURVEY_URL){try{await fetch(SURVEY_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(rec)});sent=true}catch(e){}}
 $('pid').value='';$('cmt').value='';document.querySelectorAll('#sus input').forEach(i=>i.checked=false);
 susMsg(sent?'✅ ¡Gracias! Tus respuestas fueron enviadas.':SURVEY_URL?'⚠️ No se pudo enviar (revisa tu conexión). Tu respuesta quedó guardada en este dispositivo.':'ℹ️ Respuesta guardada solo en este navegador: el envío a la hoja de resultados aún no está configurado.',sent?'ok':'am');susR()}
// susR(): muestra las respuestas guardadas en este dispositivo y el SUS promedio.
function susR(){if(!sus.length){$('susRes').textContent='Aún no hay respuestas guardadas en este dispositivo.';return}
 const m=sus.reduce((x,y)=>x+y.sus,0)/sus.length;
 $('susRes').innerHTML=`<details><summary class="note" style="cursor:pointer">Respuestas guardadas en este dispositivo: ${sus.length} · SUS promedio ${m.toFixed(1)}</summary><div class=ov><table><tr><th>Código</th><th>Perfil</th><th>Tarea</th><th class=n>SUS</th></tr>${sus.map(x=>`<tr><td>${x.codigo}</td><td>${x.perfil}</td><td>${x.tarea_sin_ayuda}</td><td class=n>${x.sus.toFixed(1)}</td></tr>`).join('')}</table></div><div class=row><button class=b onclick="susCsv()">📥 Descargar CSV</button></div></details>`}
// susCsv(): exporta las respuestas guardadas en este dispositivo a CSV (formato para Excel en español).
function susCsv(){if(!sus.length)return alert('No hay respuestas.');const k=Object.keys(sus[0]);dl('labenergy_validacion.csv',toCsv(k,sus.map(r=>k.map(c=>c==='sus'?fz(r[c].toFixed(1)):String(r[c]).replace(/[;\r\n]+/g,' ')))))}
// ---------- 10. PRUEBAS AUTOMÁTICAS DEL MODELO ----------
// tests(): se ejecuta desde la consola del navegador (F12 → Console, escribir tests()). Verifica P = V²/R, umbral del LED, aumento de R del filamento, reproducibilidad por semilla,
// razón de eficacia LED/incandescente y rango de η (0–100 %).
function tests(){const R=[],T=(n,f)=>{let o;try{o=f()}catch(e){o=false}R.push(`<span class="${o?'ok':'bad'}">${o?'✔':'✘'}</span> ${n}`)};
 const r0=()=>.5;T('Resistencia 10 Ω: P = V²/R a 12 V (±2 %)',()=>Math.abs(meas('res',12,rng32(1)).p-14.4)<.3);
 T('LED no conduce con V ≤ 9 V',()=>meas('led',9,r0).i===0);
 T('Incandescente: R aumenta con V (6 V → 14 V)',()=>meas('inc',14,r0).r>meas('inc',6,r0).r);
 T('Misma semilla → mismos datos',()=>{const a=rng32(7),b=rng32(7);return meas('inc',12,a).p===meas('inc',12,b).p});
 T('K LED / K incandescente a 12 V ≥ 5',()=>meas('led',12,r0).K/meas('inc',12,r0).K>=5);
 T('η dentro de 0–100 % en todo el rango',()=>['inc','led','res','mot'].every(k=>[0,3,6,9,12,15].every(v=>{const e=meas(k,v,r0).eta;return e>=0&&e<=100})));
 console.log(R.map(x=>x.replace(/<[^>]+>/g,'')).join('\n'))}
// ---------- 11. GRÁFICOS (Chart.js) ----------
// tk: estilo común de los ejes · ax(): opciones comunes de los gráficos.
// Tipografía y color por defecto de todos los gráficos (Chart.js).
Chart.defaults.font.family="'Exo 2',sans-serif";Chart.defaults.color='#4d567a';
const tk={ticks:{color:'#7b82a6'},grid:{color:'#e6e1f5'}},ax=(x,y)=>({responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:y!=='watts',labels:{color:'#51636f'}}},scales:{x:{...tk,title:{display:true,text:x,color:'#7b82a6'}},y:{...tk,beginAtZero:true,title:{display:true,text:y,color:'#7b82a6'}}}});
// Gráfico en vivo: potencia (W) vs tiempo (s).
const live=new Chart($('live'),{type:'line',data:{labels:[],datasets:[{data:[],borderColor:'#6d3fc0',backgroundColor:'rgba(109,63,192,.10)',fill:true,pointRadius:0,tension:.25}]},options:ax('segundos','watts')});
// Gráfico de la curva corriente–voltaje (I–V) por carga.
const civ=new Chart($('cIV'),{type:'line',data:{datasets:[]},options:{...ax('V','I (mA)'),scales:{x:{type:'linear',...tk,title:{display:true,text:'V',color:'#7b82a6'}},y:tk.constructor&&{...tk,beginAtZero:true,title:{display:true,text:'I (mA)',color:'#7b82a6'}}}}});
// Gráfico de eficiencia η (%) vs voltaje.
const ceta=new Chart($('cEta'),{type:'line',data:{datasets:[]},options:{...ax('V','η (%)'),scales:{x:{type:'linear',...tk,title:{display:true,text:'V',color:'#7b82a6'}},y:{...tk,beginAtZero:true,title:{display:true,text:'η (%)',color:'#7b82a6'}}}}});
// ---------- 11b. CIRCUITO EXTERNO (Tinkercad) ----------
// ext: puntos medidos por el estudiante en un circuito externo. Cada punto: {v (V), i (mA), lm (lúmenes o null)}.
let ext=[];
// lin(): opciones de gráfico con eje X numérico, sin leyenda.
const lin=(x,y)=>({...ax(x,y),plugins:{legend:{display:false}},scales:{x:{type:'linear',...tk,title:{display:true,text:x,color:'#7b82a6'}},y:{...tk,beginAtZero:true,title:{display:true,text:y,color:'#7b82a6'}}}});
const cxIV=new Chart($('cxIV'),{type:'line',data:{datasets:[{data:[],borderColor:'#0e9aa7',backgroundColor:'#0e9aa7',tension:.2}]},options:lin('V','I (mA)')});
const cxP=new Chart($('cxP'),{type:'line',data:{datasets:[{data:[],borderColor:'#6d3fc0',backgroundColor:'#6d3fc0',tension:.2}]},options:lin('V','P (W)')});
// ---------- 11c. INTERACTIVIDAD: CURVA, CORRIENTE Y FLECHAS ----------
// CAP: leyenda bajo la ilustración de cada carga. Las ilustraciones son SVG propios dentro de index.html (#ill).
const CAP={inc:'Lámpara incandescente: un filamento de tungsteno se calienta hasta brillar.',led:'Módulo LED de 12 V: una placa con 3 LED en serie y una resistencia que limita la corriente.',res:'Resistencia de 10 Ω (café-negro-negro-dorado): solo produce calor.',mot:'Motor DC pequeño: convierte la energía eléctrica en movimiento.',off:'Circuito abierto: el interruptor no cierra el camino, no circula corriente.'};
// Copia cada ilustración en los íconos pequeños de la pestaña Teoría (.ico).
document.querySelectorAll('.ico').forEach(e=>{const f=document.querySelector('#ill .ill[data-k="'+e.dataset.k+'"]');if(f)e.innerHTML=f.innerHTML});
// setAmp(): el usuario fija la CORRIENTE y se busca (bisección) el voltaje que la produce en la carga elegida; luego se actualiza todo.
function setAmp(){const L=LD[$('load').value],t=+$('amp').value/1000;let lo=0,hi=15;for(let n=0;n<30;n++){const mid=(lo+hi)/2;if(L.I(mid)<t)lo=mid;else hi=mid}$('volt').value=hi.toFixed(1);refresh(true)}
// delta(): flechas ▲/▼ que indican hacia dónde cambió cada magnitud respecto de la lectura anterior (se compara sin ruido).
let prevB=null;const DF={dI:'i',dP:'p',dR:'r',dL:'lm',dK:'K',dE:'eta'};
function delta(){const b=meas($('load').value,+$('volt').value,()=>.5);
 Object.entries(DF).forEach(([id,f])=>{const e=$(id);if(!prevB||prevB.k!==b.k){e.textContent='';e.className='dl';return}
  if(f==='r'&&(b.i===0||prevB.i===0))return;const d=b[f]-prevB[f];if(Math.abs(d)>1e-6*Math.max(Math.abs(prevB[f]),1)){e.textContent=d>0?'▲':'▼';e.className='dl '+(d>0?'up':'dn')}});prevB=b}
// Curva interactiva: la línea es la curva teórica de la carga (sin ruido) y el punto turquesa es la posición actual.
const MT={i:['Corriente (mA)',x=>x.i,'mA'],p:['Potencia (W)',x=>x.p,'W'],r:['Resistencia (Ω)',x=>x.r,'Ω'],eta:['Eficiencia η (%)',x=>x.eta,'%']};
let cm='i',ck='';
const cv=new Chart($('cv'),{type:'line',data:{datasets:[{data:[],borderColor:'#6d3fc0',backgroundColor:'rgba(109,63,192,.10)',fill:true,pointRadius:0,tension:.25},{data:[],showLine:false,pointRadius:9,pointHoverRadius:9,backgroundColor:'#0e9aa7',borderColor:'#ffffff',borderWidth:3}]},options:lin('Voltaje (V)','')});
cv.options.scales.x.min=0;cv.options.scales.x.max=15;
// setMetric(x): cambia la magnitud mostrada (i, p, r, eta) y marca el botón activo.
function setMetric(x){cm=x;document.querySelectorAll('#mbtn button').forEach(b=>b.classList.toggle('pr',b.dataset.m===x));ck='';updCurve()}
// updCurve(): recalcula la curva si cambió la carga o la magnitud, y mueve el punto al voltaje actual.
function updCurve(){const k=$('load').value,v=+$('volt').value,f=MT[cm][1],b=meas(k,v,()=>.5),imax=LD[k].I(15)*1000;
 if(ck!==k+cm){const pts=[];for(let x=0;x<=15.001;x+=.25){const q=meas(k,x,()=>.5);if(cm==='r'&&q.i<.03*imax)continue;pts.push({x,y:f(q)})}cv.data.datasets[0].data=pts;cv.options.scales.y.title.text=MT[cm][0];ck=k+cm}
 const ok=!(cm==='r'&&b.i<.03*imax);cv.data.datasets[1].data=ok?[{x:v,y:f(b)}]:[];cv.update('none');
 $('cvTxt').innerHTML=ok?`A <b>${v.toFixed(1)} V</b> la ${MT[cm][0].split(' (')[0].toLowerCase()} es <b>${f(b).toFixed(cm==='p'?2:1)} ${MT[cm][2]}</b>. El punto turquesa se mueve por la curva cuando cambias el voltaje o la corriente.`:'Casi no circula corriente: la resistencia no se puede calcular aquí (tiende a ∞).'}
function extMsg(t,ok){$('exMsg').innerHTML='<span class="'+(ok?'ok':'bad')+'">'+t+'</span>'}
// extEmbed(): muestra el circuito de Tinkercad en un iframe (si se pega el código de «Incrustar», usa su dirección tal cual). Solo acepta enlaces de www.tinkercad.com y extrae el identificador del circuito.
function extEmbed(){const box=$('exFrame'),m=$('exUrl').value.match(/https:\/\/www\.tinkercad\.com\/[^\s"'<>]+/),t=m&&m[0].match(/tinkercad\.com\/(?:things|embed)\/([A-Za-z0-9]+)/);
 if(!t){box.innerHTML='<span class="bad">Pega el código de «Incrustar» de Tinkercad (o un enlace https://www.tinkercad.com/…). El circuito debe tener privacidad Pública.</span>';return}
 const f=document.createElement('iframe');f.src=/tinkercad\.com\/embed\//.test(m[0])?m[0].replace(/&amp;/g,'&'):'https://www.tinkercad.com/embed/'+t[1]+'?editbtn=1';f.title='Circuito de Tinkercad';f.style.cssText='width:100%;height:420px;border:1px solid var(--l);border-radius:8px';
 box.innerHTML='';box.append(f);const a=document.createElement('p');a.className='note';a.innerHTML='¿No se ve? <a href="https://www.tinkercad.com/things/'+t[1]+'" target="_blank" rel="noopener">Ábrelo en Tinkercad</a>.';box.append(a)}
// extAdd(): agrega un punto escrito a mano (valida que sean números mayores o iguales a 0).
function extAdd(){const v=parseFloat($('exV').value),i=parseFloat($('exI').value),lm=parseFloat($('exLm').value);
 if(isNaN(v)||isNaN(i)||v<0||i<0)return extMsg('Ingresa un voltaje y una corriente válidos (números ≥ 0).');
 ext.push({v,i,lm:isNaN(lm)?null:lm});['exV','exI','exLm'].forEach(k=>$(k).value='');extMsg('Punto agregado ('+ext.length+' en total).',1);extRender()}
// extPaste(): lee líneas "voltaje;corriente" (separadas por ; tabulación, espacio o coma). Acepta coma decimal e ignora líneas de encabezado.
function extPaste(){const k=$('exUp').value==='A'?1000:1;let n=0,x=0;
 $('exTxt').value.split(/\r?\n/).forEach(l=>{l=l.trim();if(!l)return;let t=l.split(/[;\t ]+/);if(t.length<2)t=l.split(',');
  const v=parseFloat((t[0]||'').replace(',','.')),i=parseFloat((t[1]||'').replace(',','.'))*k;
  if(t.length<2||isNaN(v)||isNaN(i)||v<0||i<0){x++;return}ext.push({v,i,lm:null});n++});
 $('exTxt').value='';extMsg(n+' punto(s) agregado(s)'+(x?'; '+x+' línea(s) ignorada(s).':'.'),n>0);extRender()}
function extUndo(){ext.pop();extMsg('Se quitó el último punto.',1);extRender()}
function extClear(){ext=[];$('exMsg').innerHTML='';extRender()}
// extExample(n): carga datos de ejemplo. 1 = resistencia de 220 Ω; 2 = LED rojo con resistencia de 220 Ω (conduce desde ≈ 1,8 V).
function extExample(n){ext=n===1?[1,3,5,7,9].map(v=>({v,i:v/220*1000,lm:null})):[0,1,1.5,2,3,4,5].map(v=>({v,i:Math.max(0,(v-1.8)/220*1000),lm:null}));extMsg('Ejemplo cargado: revisa tabla, gráficos y diagnóstico.',1);extRender()}
// extCalc(): agrega a cada punto P = V·I, R = V/I y, si hay lúmenes, K = lm/P y η = K/250·100.
function extCalc(){return ext.map(x=>{const p=x.v*x.i/1000,K=x.lm!=null&&p>0?x.lm/p:null;return{...x,p,r:x.i>0?x.v/(x.i/1000):null,K,eta:K!=null?K/KID*100:null}})}
function extCsv(){if(!ext.length)return alert('Aún no hay puntos.');const n=v=>v==null?'':fz(v.toFixed(2));
 dl('labenergy_circuito_externo.csv',toCsv(['N°','Tensión (V)','Corriente (mA)','Potencia (W)','Resistencia (Ω)','Flujo luminoso (lm)','Eficacia (lm/W)','Eficiencia η (%)'],extCalc().map((x,k)=>[k+1,fz(x.v),fz(x.i.toFixed(1)),fz(x.p.toFixed(3)),x.r==null?'∞':fz(x.r.toFixed(1)),n(x.lm),n(x.K),n(x.eta)])))}
// diag(): interpreta los datos: circuito abierto, tensión umbral (diodo/LED), carga óhmica o no lineal, y a cuál modelo de LabEnergy se parece.
function diag(p){const d=p.filter(x=>x.v>0).sort((a,b)=>a.v-b.v);
 if(d.length<3)return 'Ingresa al menos 3 puntos con voltajes distintos para poder diagnosticar.';
 const imax=Math.max(...d.map(x=>x.i));if(imax<=0)return '🔌 No circula corriente en ningún punto: el circuito está abierto o hay una conexión suelta.';
 const off=d.filter(x=>x.i<=.02*imax),on=d.filter(x=>x.i>.02*imax),o=[];
 if(off.length&&on.length&&off[off.length-1].v<on[0].v)o.push('💡 <b>Tensión umbral:</b> la corriente aparece entre '+off[off.length-1].v+' y '+on[0].v+' V. Es el comportamiento típico de un LED o un diodo.');
 else{const R=on.map(x=>x.v/(x.i/1000)),m=R.reduce((a,b)=>a+b,0)/R.length,rel=(Math.max(...R)-Math.min(...R))/m;
  if(rel<.05)o.push('📏 <b>Carga óhmica:</b> R ≈ '+m.toFixed(1)+' Ω casi constante; cumple la Ley de Ohm y su curva I–V es una recta.');
  else if(R[R.length-1]>R[0]*1.05)o.push('🔥 <b>Carga no lineal, R aumenta con el voltaje:</b> típico de un filamento que se calienta.');
  else if(R[R.length-1]<R[0]*.95)o.push('⚙️ <b>Carga no lineal, R disminuye con el voltaje:</b> típico de componentes semiconductores.');
  else o.push('📈 <b>Carga no lineal</b> con comportamiento irregular: revisa que las mediciones estén bien hechas.')}
 let b=null,e=9;['inc','led','res','mot'].forEach(k=>{const s=d.reduce((a,x)=>a+Math.abs(LD[k].I(x.v)*1000-x.i)/Math.max(x.i,10),0)/d.length;if(s<e){e=s;b=k}});
 o.push(e<.25?'🔎 Se parece al modelo «'+LD[b].n+'» de LabEnergy (error medio ≈ '+(e*100).toFixed(0)+' %).':'🔎 No coincide con ninguna de las cargas internas de LabEnergy: es un buen caso para estudiar por separado.');
 return o.join('<br>')}
// kind(p): tipo de carga según los datos: 'open' (sin corriente), 'thr' (tensión umbral: LED/diodo), 'ohm' (óhmica) o 'nl' (no lineal). Devuelve null si hay menos de 3 puntos.
function kind(p){const d=p.filter(x=>x.v>0).sort((a,b)=>a.v-b.v);if(d.length<3)return null;const im=Math.max(...d.map(x=>x.i));if(im<=0)return 'open';
 const off=d.filter(x=>x.i<=.02*im),on=d.filter(x=>x.i>.02*im);if(off.length&&on.length&&off[off.length-1].v<on[0].v)return 'thr';
 const R=on.map(x=>x.v/(x.i/1000)),m=R.reduce((a,b)=>a+b,0)/R.length;return (Math.max(...R)-Math.min(...R))/m<.05?'ohm':'nl'}
// extEff(): conclusión de EFICIENCIA del circuito externo (usa los lúmenes ingresados; sin ellos, orienta al estudiante).
function extEff(f){if(!f.length)return '<h2>Eficiencia de tu circuito</h2><p>Ingresa tus mediciones para evaluar qué tan eficiente es tu circuito.</p>';
 const e=f.filter(x=>x.eta!=null&&x.eta<=100),bad=f.filter(x=>x.eta>100),kd=kind(ext);let t='';
 // η no puede superar 100 % (K máx. ≈ 250 lm/W): si ocurre, el flujo luminoso ingresado es inconsistente.
 const warn=bad.length?'<p>⚠️ En '+bad.length+' punto(s) la eficiencia sale mayor a 100 %, lo cual es imposible: revisa los lúmenes (lm) ingresados. Esos puntos no se usan en la conclusión.</p>':'';
 if(e.length){const b=e.reduce((a,x)=>x.eta>a.eta?x:a);
  t=`<div class="kk"><div><small>Eficiencia η máxima</small><span class="big">${b.eta.toFixed(1)} %</span><br>a ${b.v} V</div><div><small>Eficacia K</small><span class="big">${b.K.toFixed(0)}</span> lm/W</div><div><small>Pérdida por calor</small><span class="big">${(100-b.eta).toFixed(0)} %</span></div></div>
  <p>Tu circuito convierte hasta ≈ <b>${b.eta.toFixed(1)} %</b> de la energía eléctrica en luz y el resto se pierde como calor. Referencias de LabEnergy: LED ≈ 40 %, incandescente ≈ 4 %. ${b.eta>=30?'Tu eficiencia es comparable a la de un LED.':b.eta<=8?'Tu eficiencia es similar a la de una lámpara incandescente: hay mucho margen de mejora.':'Tu eficiencia está entre la de una incandescente y la de un LED.'}</p>`}
 else if(kd==='ohm')t='<p>Tu carga es <b>resistiva</b>: toda la potencia se convierte en calor (eficiencia lumínica ≈ <b>0 %</b>). Para mejorar la eficiencia, usa una carga que convierta la energía en luz o movimiento, como un LED.</p>';
 else t='<p>Para calcular la <b>eficiencia</b> falta el flujo luminoso (lm): ingrésalo en el formulario (Tinkercad no mide la luz; usa el dato del componente real o un valor de referencia de tu docente). Mientras tanto, recuerda: a igual luz, menos potencia consumida significa mayor eficiencia (hoy consumes hasta '+Math.max(...f.map(x=>x.p)).toFixed(2)+' W).</p>';
 return '<h2>Eficiencia de tu circuito</h2>'+t+warn}
// extModel(): modelo simple con los puntos que conducen. iAt(v) estima la corriente a un voltaje; vAt(i) el voltaje para una corriente. Óhmica: I = V/R; otro caso: recta con los dos últimos puntos.
function extModel(f){const on=f.filter(x=>x.v>0&&x.i>0).sort((a,b)=>a.v-b.v);if(on.length<2)return null;
 const R=on.map(x=>x.v/(x.i/1000)),m=R.reduce((a,b)=>a+b,0)/R.length,oh=(Math.max(...R)-Math.min(...R))/m<.05,a=on[on.length-2],b=on[on.length-1],sl=(b.i-a.i)/(b.v-a.v);
 if(!oh&&!(isFinite(sl)&&sl>0))return null;return{oh,iAt:v=>oh?v/m*1000:Math.max(0,b.i+sl*(v-b.v)),vAt:i=>oh?i/1000*m:b.v+(i-b.i)/sl}}
const kMean=f=>{const k=f.filter(x=>x.K!=null);return k.length?k.reduce((a,x)=>a+x.K,0)/k.length:null};
// extRange(): rango de operación en lenguaje simple: lo probado (V, I, P, lm), una barra de voltaje y una estimación hasta 15 V.
function extRange(f){if(f.length<2)return '<p class="dim">Ingresa al menos 2 puntos para ver el rango de operación.</p>';
 const mm=a=>[Math.min(...a),Math.max(...a)],fm=(a,d)=>a[0].toFixed(d)+' – '+a[1].toFixed(d),V=mm(f.map(x=>x.v)),I=mm(f.map(x=>x.i)),P=mm(f.map(x=>x.p)),lm=f.filter(x=>x.lm!=null).map(x=>x.lm),Lm=lm.length?mm(lm):null,md=extModel(f),k=kMean(f);
 let o=`<p>Lo que probaste: tu circuito funcionó entre <b>${V[0]}</b> y <b>${V[1]} V</b>, con corriente de <b>${fm(I,1)} mA</b> y potencia de <b>${fm(P,3)} W</b>${Lm?`, produciendo de <b>${Lm[0]}</b> a <b>${Lm[1]} lm</b>`:''}.</p>
 <div class="kp"><div class="k"><small>Voltaje (V)</small><b>${fm(V,1)}</b></div><div class="k"><small>Corriente (mA)</small><b>${fm(I,1)}</b></div><div class="k"><small>Potencia (W)</small><b>${fm(P,3)}</b></div><div class="k"><small>Flujo luminoso (lm)</small><b>${Lm?fm(Lm,0):'—'}</b></div></div>
 <div class="rng"><i style="left:${Math.min(100,V[0]/15*100)}%;width:${Math.max(2,Math.min(100,(V[1]-V[0])/15*100))}%"></i></div><div class="note">La barra muestra dónde caen tus voltajes dentro de 0–15 V (máximo de la fuente de LabEnergy).</div>`;
 if(md){const i=md.iAt(15),p=15*i/1000;o+=`<p><b>Si subieras hasta 15 V</b> (estimación aproximada${md.oh?'; carga óhmica, I = V/R':''}): corriente ≈ <b>${i.toFixed(0)} mA</b>, potencia ≈ <b>${p.toFixed(2)} W</b>${k?`, luz ≈ <b>${(k*p).toFixed(0)} lm</b>`:''}.</p>`}
 return o}
// extSafe(): si el estudiante indica la corriente máxima de su componente, estima hasta qué voltaje se puede subir.
function extSafe(f){const im=parseFloat($('exImax').value);if(isNaN(im)||im<=0)return '';const md=extModel(f);
 if(!md)return '<span class="dim">Ingresa más puntos para estimar el rango seguro.</span>';const v=md.vAt(im);
 if(!isFinite(v)||v<0)return '<span class="dim">No se pudo estimar con estos datos.</span>';const p=v*im/1000,k=kMean(f);
 return `<div class="box">✅ <b>Rango seguro estimado:</b> de 0 a ≈ <b>${v.toFixed(1)} V</b> (corriente máxima ${im} mA). En ese límite: potencia ≈ <b>${p.toFixed(3)} W</b>${k?`, luz ≈ <b>${(k*p).toFixed(0)} lm</b>`:''}.${v>15?' Supera los 15 V de la fuente de LabEnergy: puedes usar todo su rango.':''}<br><span class="note">Es una estimación: confirma el límite en la ficha técnica del componente.</span></div>`}
// extRender(): redibuja tabla, gráficos, diagnóstico y consumo estimado (con el último punto ingresado).
function extRender(){const f=extCalc();
 $('exTb').innerHTML=f.length?f.map((x,n)=>`<tr><td class=n>${n+1}</td><td class=n>${x.v}</td><td class=n>${x.i.toFixed(1)}</td><td class=n>${x.p.toFixed(3)}</td><td class=n>${x.r==null?'∞':x.r.toFixed(1)}</td><td class=n>${x.lm==null?'—':x.lm}</td><td class=n>${x.K==null?'—':x.K.toFixed(1)}</td><td class=n>${x.eta==null?'—':x.eta>100?'⚠ revisa lm':x.eta.toFixed(1)}</td></tr>`).join(''):'<tr><td colspan=8 class=dim>Aún no hay puntos. Ingresa mediciones arriba.</td></tr>';
 const s=[...f].sort((a,b)=>a.v-b.v);cxIV.data.datasets[0].data=s.map(x=>({x:x.v,y:x.i}));cxP.data.datasets[0].data=s.map(x=>({x:x.v,y:x.p}));cxIV.update();cxP.update();
 $('exDx').innerHTML=diag(ext);
 $('exEff').innerHTML=extEff(f);$('exRange').innerHTML=extRange(f);$('exSafe').innerHTML=extSafe(f);
 const l=f[f.length-1],h=+$('exH').value||0,t=+$('exT').value||0;
 $('exCost').innerHTML=l?(k=>`Con el último punto (${l.v} V, ${l.i.toFixed(1)} mA → ${l.p.toFixed(3)} W) usado ${h} h/día: <b>${k.toFixed(2)} kWh/mes</b> · <b>$${Math.round(k*t).toLocaleString('es-CL')}</b>/mes · <b>${(k*EF).toFixed(2)} kg CO₂</b>/mes.`)(l.p/1000*h*30):''}
// ---------- 12. INICIO ----------
// Al cargar la página: inicia el ruido con la semilla, muestra la primera lectura y dibuja tablas y sesiones.
setSeed();refresh();render();susR();extRender();
