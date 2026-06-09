# Recomendador FPE Costa Rica

Sitio web de una sola vista para orientar opciones de estudio aprobadas por el FPE en Costa Rica, usando un CSV local como fuente de verdad y un endpoint backend para recomendacion asistida por IA.

## Instalar

```bash
pnpm install
```

## Configurar

Copiar `.env.example` a `.env` y agregar `AI_API_KEY`.

```bash
cp .env.example .env
```

Obtener una clave gratuita en [Groq Console](https://console.groq.com/keys). El modelo por defecto es `llama-3.3-70b-versatile`.

## Ejecutar

```bash
pnpm run dev
```

## Crear build

```bash
pnpm run build
```

## Desplegar

Subir a Vercel y configurar `AI_API_KEY` en Environment Variables. Opcionalmente `AI_MODEL` para cambiar el modelo.

## Datos

El archivo de carreras aprobadas debe estar en:

```txt
data/fpe_carreras_costa_rica_2026.csv
```
