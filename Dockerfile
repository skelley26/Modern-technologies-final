FROM nginx:alpine

COPY index.html recipes.html styles.css recipes.css script.js recipes.js /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080