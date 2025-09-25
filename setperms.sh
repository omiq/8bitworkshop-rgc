#!/bin/bash
sudo chown -R ide:www-data /home/ide/htdocs/ide.retrogamecoders.com
sudo find /home/ide/htdocs/ide.retrogamecoders.com -type d -exec chmod 0755 {} \;
sudo find /home/ide/htdocs/ide.retrogamecoders.com -type f -exec chmod 0644 {} \;

# Important: allow traverse on parent dirs too
sudo chmod 0711 /home/ide
sudo chmod 0711 /home/ide/htdocs