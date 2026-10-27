# Lab ENERGY — Laboratorio digital energético al alcance de todos

**G09 · Proyecto de innovación tecnológica · Energía y eficiencia**

Laboratorio digital que se visualiza en pantalla (celular, tablet o PC) para estudiar la **eficiencia de conversión de energía en cargas de baja tensión (0–15 V DC)**. No requiere hardware ni instalación.

## Qué permite hacer

- Ensayar 5 cargas (incandescente, módulo LED, resistencia 10 Ω, motor DC, circuito abierto) variando la tensión.
- Controlar el voltaje o la corriente y ver al instante qué pasa con resistencia, potencia y eficiencia (curva interactiva, flechas ▲▼ y barra de reparto luz/calor).
- Medir en tiempo real corriente, potencia, resistencia, flujo luminoso, eficacia (lm/W) y eficiencia η.
- Ejecutar un **barrido automático reproducible** (misma semilla = mismos datos) y descargar los resultados en CSV.
- Analizar un circuito externo armado en Tinkercad: ingreso manual o pegado de datos del Monitor Serie, gráficos, diagnóstico automático y CSV.
- Estudiar la teoría (Ley de Ohm, potencia, eficiencia y las 5 cargas) en la pestaña Teoría.
- Verificar una hipótesis (H1) con los datos registrados.
- Validar la usabilidad con el cuestionario SUS (pestaña Validación); las respuestas se envían a una hoja de Google (ver el final de este documento).

## Cómo usarlo

- **En línea:** https://yaelmanriquez-bot.github.io/Energy.lab/ (tras activar GitHub Pages).
- **Local:** descargar `index.html`, `style.css` y `script.js` en la misma carpeta y abrir `index.html` en el navegador. Requiere internet solo para cargar Chart.js y las tipografías.

## Publicar con GitHub Pages

1. *Settings → Pages*.
2. *Deploy from a branch* → rama `main`, carpeta `/ (root)` → *Save*.

## Estructura del repositorio

```
index.html     Estructura y contenido de la página
style.css      Estilos (colores y tipografías)
script.js      Modelo físico, gráficos y encuesta
README.md      Este documento
/datos         (sugerido) CSV exportados desde la aplicación
/docs          (sugerido) informe y guía de laboratorio
```

## Pruebas

Abre la página, pulsa F12 → pestaña *Console*, escribe `tests()` y presiona Enter. Se verifica el modelo: P = V²/R en la resistencia, umbral de conducción del LED, aumento de la resistencia del filamento con la tensión, reproducibilidad por semilla, razón de eficacia LED/incandescente y rango de η (0–100 %).

## Estado del proyecto

| Componente | Estado |
|---|---|
| Simulador, guía, análisis y exportación CSV | Implementado (simulado) |
| Integración con hardware real | No implementado (trabajo futuro) |

## Limitaciones

Los datos provienen de **modelos simplificados**, no de mediciones físicas. Los precios, la vida útil y los valores de eficacia son referenciales. La extrapolación a 220 V es una proyección, no una medición. Factor de emisión usado: 0,4 kg CO₂/kWh.

## Equipo

Yael Manríquez Rojas · Agustín Hernández · Benjamín Ramírez · Krishna Chade Arias · Moisés Ojeda Gómez · Vicente Fuenzalida

Asignatura: Proyecto innovación tecnológico — Prof. Edgar Patricio Cáceres.

## Recibir las respuestas de la encuesta (Validación)

La página es estática, así que necesita un destino para guardar las respuestas. La opción gratuita más simple es una hoja de Google:

1. Crea una hoja nueva en Google Sheets (por ejemplo «Respuestas LabEnergy»).
2. En la hoja: *Extensiones → Apps Script*. Borra el código y pega:

```javascript
function doPost(e){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var sh=ss.getSheetByName('Respuestas')||ss.insertSheet('Respuestas');
  var d=JSON.parse(e.postData.contents), k=Object.keys(d);
  if(sh.getLastRow()===0) sh.appendRow(k);
  sh.appendRow(k.map(function(c){return d[c]}));
  return ContentService.createTextOutput('ok');
}
```

3. *Implementar → Nueva implementación → Aplicación web*. Ejecutar como: **yo**. Quién tiene acceso: **cualquier persona**. Autoriza los permisos.
4. Copia la URL que termina en `/exec`.
5. En `script.js`, pega esa URL en `const SURVEY_URL='...'` y sube el archivo a GitHub.
6. Prueba con una respuesta: debe aparecer una fila en la pestaña «Respuestas» de tu hoja. Si cambias el código del script, vuelve a implementar (*Nueva versión*).
