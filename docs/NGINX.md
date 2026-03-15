## chatmosphere behind nginx proxy

This is an example how to run chatmosphere behind an nginx proxy with a dedicated domain on Debian and Lets Encrypt certificates. 

     nano /etc/nginx/sites-available/chatmosphere.conf

Put this into your configuration and adapt the domain 'chat.yourdomain.net': 

```
upstream chatmosphere {
  server localhost:3000;
}

map $http_host $this_host {
    "" $host;
    default $http_host;
}

map $http_x_forwarded_proto $the_scheme {
     default $http_x_forwarded_proto;
     "" $scheme;
}

map $http_x_forwarded_host $the_host {
    default $http_x_forwarded_host;
    "" $this_host;
}

map $http_upgrade $proxy_connection {
  default upgrade;
  "" close;
}

proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $proxy_connection;
proxy_set_header X-Forwarded-Host $the_host;
proxy_set_header X-Forwarded-Proto $the_scheme;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

## Normal HTTP host
server {
  listen 80;
  listen [::]:80;
  server_name hello.fairmeeting.net;
  server_tokens off;

  root /var/www/certbot;
  location /.well-known/acme-challenge/ { allow all; }

  ## Redirects all traffic to the HTTPS host
  return 301 https://$server_name:443$request_uri;
}
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name hello.fairmeeting.net;
  server_tokens off;
#   root /usr/share/nginx/html;
  root /var/www/certbot;
  location /.well-known/acme-challenge/ { allow all; }

  ## Strong SSL Security
  ## https://raymii.org/s/tutorials/Strong_SSL_Security_On_nginx.html
  ssl on;
# get some certs 
  ssl_certificate     /etc/letsencrypt/live/chat.yourdomain.net/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/chat.yourdomain.net/privkey.pem;
  ssl_verify_client off;

  ssl_ciphers "EECDH+AESGCM:EDH+AESGCM:AES256+EECDH:AES256+EDH";

  ssl_protocols  TLSv1 TLSv1.1 TLSv1.2;
  ssl_session_cache  builtin:1000  shared:SSL:10m;

  ssl_prefer_server_ciphers   on;
  location / {
    proxy_pass https://chatmosphere;
    proxy_http_version 1.1;
  }
}
```

Get your certificates

    certbot certonly --webroot --webroot-path /var/www/certbot -d chat.yourdomain.net
    ln -s /etc/nginx/sites-available/chatmosphere.conf /etc/nginx/sites-enabled/chatmosphere.conf
    service nginx reload

We need to copy the certificates after each renewal, assuming that chatmosphere runs with its own user 'chatmosphere', which would not have permission to access the certs.

```
#!/bin/sh

set -e

CHATMOSPHERE_CERT_DIR="/opt/chatmosphere/.certs"

# create a directory to store certs if it does not exists
if [ ! -d "$CHATMOSPHERE_CERT_DIR" ]; then
    mkdir -p $CHATMOSPHERE_CERT_DIR
    chown -R chatmosphere:chatmosphere $CHATMOSPHERE_CERT_DIR
    chmod -R 700 $CHATMOSPHERE_CERT_DIR
fi

# This is a template and when copied to /etc/letsencrypt/renewal-hooks/deploy/
# during creating the Let's encrypt certs script
# turn.fairmeeting.net will be replaced with the real domain of deployment
for domain in $RENEWED_DOMAINS; do
        case $domain in
        chat.yourdomain.net)
                # Make sure the certificate and private key files are
                # never world readable, even just for an instant while
                # we're copying them into daemon_cert_root.
                umask 077

                cp "$RENEWED_LINEAGE/fullchain.pem" "$CHATMOSPHERE_CERT_DIR/cert.pem"
                cp "$RENEWED_LINEAGE/privkey.pem" "$CHATMOSPHERE_CERT_DIR/key.pem"

                # Apply the proper file ownership and permissions for
                # the daemon to read its certificate and key.
                chown chatmosphere "$CHATMOSPHERE_CERT_DIR/cert.pem" \
                        "$CHATMOSPHERE_CERT_DIR/key.pem"
                chmod 400 "$CHATMOSPHERE_CERT_DIR/cert.pem" \
                        "$CHATMOSPHERE_CERT_DIR/key.pem"

                service nginx reload
                ;;
        esac
done
```
