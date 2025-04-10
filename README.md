# JHE-Setup
JHE setup
## Deploying on Local Machine
## Setting Up Azure VM
(TODO: Add Azure VM setup instructions here.)
### 1. Clone the Repository
  ``` sh
    git clone https://github.com/the-commons-project/jupyterhealth-exchange.git
    cd jupyterhealth-exchange
  ```
### 2. Set Up Python Environment
- Check your Python version (ensure it's between 3.10 and 3.13):  
  ``` sh
  python3 --version`
- Create a virtual environment and activate it:  
  ``` sh
  python3 -m venv venv
  source venv/bin/activate
### 3. Install the Required Dependencies
- Install the dependencies from the `requirements.txt` (or `Pipfile` if using Pipenv):  
  ``` sh
  pip install -r requirements.txt
- Install other dependencies not included in 'requirements.text':
  ``` sh
  pip install python-dotenv
  pip install django-oauth-toolkit
  pip install djangorestframework
  pip install fhirclient
  pip install fhir.resources
  pip install humps
  pip install psycopg2
  pip install psycopg2-binary
  pip install djangorestframework-camel-case
  pip install whitenoise
### 4. Create a New PostgreSQL Database
1.  Deactivate from your venv if it is activated
     ``` sh
     deactivate  
3.  install PostgreSQL:
     ``` sh
     sudo apt update
     sudo apt install postgresql postgresql-contrib
2. Create a new database and user:  
   ``` sh
   sudo -i -u postgres psql 
   CREATE DATABASE 'your_db';
   CREATE USER 'your_username' WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE 'your_db' TO 'your_username';
   -U your_database_user -d your_database_name
   GRANT USAGE ON SCHEMA public TO speziuser;
   GRANT CREATE ON SCHEMA public TO speziuser;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO speziuser;
   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO speziuser;
   \q
3. Exit the PostgreSQL shell:  
   ``` sh
   exit
4. Check if all prvileges were applied correctly:
   ``` sh
   \dn+ public
### 5. Create a .env File:
1. Make a copy of 'env_example.txt'
   ``` sh
    cp env_example.txt .env
3. Update the 'DB_*' properties to match the your new DB and save it as '.env'
    ``` sh
    nano .env

### Generate an RSA private key 
openssl genpkey -algorithm RSA -out oidc_private_key.pem -pkeyopt rsa_keygen_bits:2048
2. View the Private Key in PEM Format
cat oidc_private_key.pem

Update settings.py with the generated private key 

OIDC_RSA_PRIVATE_KEY = """
-----BEGIN PRIVATE KEY-----
(your key content)
-----END PRIVATE KEY-----
"""

### 6. Apply migrations
Run migrations to create the necessary tables:
    ``` sh
    python manage.py migrate
### 7. Run seed script
  ``` sh
    psql -U speziuser -d spezi_db -f db/seed.sql
  ```

### 8 Check if steps has worked so far
Run the `manage.py` file
``` sh
  python manage.py runserver 0.0.0.0:8000
```
It should load the login page as follows: 


Browse to http://localhost:8000/admin and enter the credentials `super@example.com` `Jhe1234!`
1. Browse to *Applications* under *Django OAuth Toolkit* and create a new application
   - Leave *User* empty
   - Set *Redirect URLs* to include `http://localhost:8000/auth/callback` and any other hosts
   - ** for HTTPS, add `https://localhost:8000/auth/callback`
   - ** for virtual machne, localhost will not work. Add `http://<your_vm_ip_address>:8000/auth/callback`
   - Set *Type* to Public
   - Set *Authorization Grant Type* to Authorization code
   - Leave *Secret* blank
   - *Name* the app whatever you like
   - Check *Skip authorization*
   - Set *Algorithm* to RSA with SHA-2 256
   - Skip Allowed origins for now10.
1. Return to the `.env` file and update `OIDC_CLIENT_ID` with the newly created app Client ID and restart the python environment and Django server
1. Browse to http://localhost:8000/ and log in with the credentials `anna@example.com` `Jhe1234!`and you should be directed to the `/portal/organizations` path with some example Organizations is the dropdown

## Setting Up HTTPS
When deploying JHE through a VM, establishing a 
(TODO: Add HTTPS setup instructions here.)
    ``` sh
      Install nginx
      sudo apt update
      sudo apt install nginx

Generate a self-signed SSL certificate
   ``` sh
    openssl genrsa -out private_key.pem 2048
```

## Step 3: Configure Nginx for Reverse Proxy with HTTPS
    ``` sh
    sudo nano /etc/nginx/sites-available/default  # For default server
    sudo systemctl restart nginx

Step 4: Configure Django for Proxy Headers (Optional)

In your `settings.py` file, add the following settings:

# For proper handling of HTTPS when behind a reverse proxy
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Ensure cookies are secure (important for production)
```
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
```

Update your `/etc/nginx/sites-available/jhe-site` for both HTTP (port 8080) and HTTPS (port 443)

Update application settings in django server 
Double check static files location 

If the static files do not have the necessary permissions, run
  ``` sh
    sudo chmod -R 755 /home/speziuser/jupyterhealth-exchange/jhe/staticfiles/
    sudo chown -R www-data:www-data /home/speziuser/jupyterhealth-exchange/jhe/staticfiles/
```

### Run the server
    ``` sh
    python manage.py runserver 0.0.0.0:8000