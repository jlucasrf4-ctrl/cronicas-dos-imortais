/* ==== Fase 4 ====
   shaders GLSL (cena, sombra, contorno) e as cores de pelagem do lobo 3D. Saíram de base/11 (v3.12) e v4.6 */

export const WOLF_COATS = ["#8d9097", "#5a5e66", "#8c5f3d", "#ddd3c4", "#7d3d32", "#34353c", "#4a5064"];
export const GL_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC; layout(location=4) in vec2 aUV;
uniform mat4 uVP, uM, uL; out vec3 vN; out vec3 vC_; out vec4 vL; out vec3 vW; out vec2 vUV;
void main(){ vec4 w = uM * vec4(aP, 1.0); vW = w.xyz; vN = mat3(uM) * aN; vC_ = aC; vUV = aUV; vL = uL * w; gl_Position = uVP * w; }`;
export const GL_FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vN; in vec3 vC_; in vec4 vL; in vec3 vW; in vec2 vUV; uniform sampler2DShadow uS; uniform sampler2D uTex; uniform float uUsaTex; uniform vec3 uLd; uniform vec4 uTint; uniform vec3 uCam, uFogC; uniform vec2 uFog; uniform vec4 uVD; uniform vec3 uNoite; uniform vec4 uFogos[4]; uniform vec3 uFogoC; uniform float uBrilha; out vec4 o;
void main(){
  vec3 vC = uUsaTex > 0.5 ? vC_ * texture(uTex, vUV).rgb : vC_;
  vec3 n = normalize(vN); float d = max(dot(n, -uLd), 0.0);
  vec3 lp = vL.xyz / vL.w * 0.5 + 0.5; vec2 ts = 1.0 / vec2(textureSize(uS, 0)); float sh = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) sh += texture(uS, vec3(lp.xy + vec2(x, y) * ts * 1.5, lp.z - 0.0012));
  sh /= 9.0; if (lp.x < 0.0 || lp.x > 1.0 || lp.y < 0.0 || lp.y > 1.0) sh = 1.0;
  float band = (smoothstep(0.02, 0.08, d) * 0.62 + smoothstep(0.40, 0.48, d) * 0.38) * smoothstep(0.35, 0.65, sh);
  vec3 col = vC * mix(vec3(0.52, 0.55, 0.72), vec3(1.0, 0.96, 0.88), band);
  col += vC * vec3(0.05, 0.06, 0.09) * (n.y * 0.5 + 0.5);
  vec3 V = uVD.w > 0.5 ? normalize(uVD.xyz) : normalize(uCam - vW);
  float rim = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
  col += rim * smoothstep(-0.25, 0.35, dot(n, -uLd)) * 0.5 * vec3(1.0, 0.92, 0.78) * (0.35 + 0.65 * sh);
  float Lm = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(Lm), col, 1.08);
  col = mix(col, uTint.rgb, uTint.a);
  if (uFog.y > uFog.x) col = mix(col, uFogC, clamp((distance(vW, uCam) - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0) * 0.85);
  float fogo = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 F = uFogos[i]; if (F.w <= 0.0) continue;
    vec3 Lf = F.xyz - vW; float dd = length(Lf), a = clamp(1.0 - dd / F.w, 0.0, 1.0);
    fogo += a * a * (0.35 + 0.65 * max(dot(n, Lf / max(dd, 0.001)), 0.0));
  }
  o = vec4(mix(col * uNoite + vC * uFogoC * fogo, col, uBrilha), 1.0);
}`; // v8.0: uUsaTex = 1 numa malha com textura (os prédios da vila, render/gl/vila_tex.ts): a cor é vértice × textura
// v8.0: uNoite = a luz da hora no campo (render/luz_do_dia.ts); 1,1,1 fora dele. uFogos = as fogueiras acesas
// (x, y, z, raio; raio 0 = sem luz), uFogoC = a cor × a força; uBrilha = 1 nas chamas (não escurecem com a noite)
export const GL_SVS = `#version 300 es
layout(location=0) in vec3 aP; uniform mat4 uL, uM; void main(){ gl_Position = uL * uM * vec4(aP, 1.0); }`;
export const GL_SFS = `#version 300 es
precision mediump float; out vec4 o; void main(){ o = vec4(1.0); }`;
export const GL_OVS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=3) in vec3 aS; uniform mat4 uVP, uM; uniform float uTh, uPush;
void main(){ vec4 w = uM * vec4(aP, 1.0); vec3 n = mat3(uM) * aS; float l = length(n); if (l > 1e-5) n /= l; w.xyz += n * uTh * 1.2; vec4 p = uVP * w; p.z += uPush * p.w; gl_Position = p; }`; // v5.8: espessura do contorno no mundo (peças esticadas não viram borrões)
export const GL_OFS = `#version 300 es
precision mediump float; uniform vec3 uCol; out vec4 o; void main(){ o = vec4(uCol, 1.0); }`;
