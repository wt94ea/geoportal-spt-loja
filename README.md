# Geoportal SPT Geoarquitec

Geoportal profesional para visualización pública de sondeos SPT con datos anonimizados.

## Datos

Archivo principal:

```text
data/spt_puntos.geojson
```

Registros publicados:

```text
245
```

## Privacidad

El dataset público NO contiene:

- Nombre del cliente
- Dueño del predio
- Barrio
- Parroquia
- Nombre específico del lugar perforado

Se conserva únicamente información técnica geotécnica y una zona pública general.

## Publicación en GitHub Pages

1. Subir estos archivos al repositorio.
2. Ir a Settings → Pages.
3. Seleccionar:
   - Source: Deploy from a branch
   - Branch: main
   - Folder: /root
4. Guardar.

## Dominio empresarial sugerido

```text
geoportal.geoarquitec.com
```

Para activarlo, configurar un CNAME en el proveedor DNS:

```text
Host/Name: geoportal
Type: CNAME
Target: wt94ea.github.io
```

Luego colocar el dominio en Settings → Pages → Custom domain.

## Nota

El archivo `CNAME_para_activar_dominio.txt` contiene el dominio sugerido. No lo subas como `CNAME` hasta tener configurado el DNS.
