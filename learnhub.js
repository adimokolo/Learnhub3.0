'use strict';
const http        = require('http');
const url         = require('url');
const { Pool }    = require('pg');
const bcrypt      = require('bcrypt');
const redis       = require('redis');

const PORT = 4000;
const SALT_ROUNDS = 10;

// ─── PostgreSQL ───────────────────────────────────────────────────────────────
const db = new Pool({
  host:     'host.docker.internal',
  port:     5432,
  database: 'learnhub',
  user:     'learnhubuser',
  password: 'LearnHub@123',
});

// ─── Redis (session store) ────────────────────────────────────────────────────
const redisClient = redis.createClient({
  socket: { host: 'host.docker.internal', port: 6379 }
});
redisClient.connect().catch(console.error);

// ─── DB INIT ──────────────────────────────────────────────────────────────────
async function initDB() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      email      VARCHAR(150) UNIQUE NOT NULL,
      password   VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS enrollments (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      course_id   VARCHAR(50) NOT NULL,
      enrolled_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, course_id)
    );
    CREATE TABLE IF NOT EXISTS quiz_results (
      id       SERIAL PRIMARY KEY,
      user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
      score    INTEGER NOT NULL,
      total    INTEGER NOT NULL,
      taken_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS lessons (
      id        SERIAL PRIMARY KEY,
      course_id VARCHAR(50) NOT NULL,
      title     VARCHAR(200) NOT NULL,
      content   TEXT NOT NULL,
      order_num INTEGER NOT NULL
    );
  `);

  // Seed lessons if empty
  const { rowCount } = await db.query('SELECT id FROM lessons LIMIT 1');
  if (rowCount === 0) {
    const lessons = [
      ['linux','Introduction to Linux',
`Linux is a free, open-source operating system kernel created by Linus Torvalds in 1991. Today it powers over 90% of the world's servers, all Android devices, and most cloud infrastructure including AWS and Azure.

THE LINUX FILESYSTEM HIERARCHY
Linux organizes files in a tree structure starting from the root directory "/":
  /bin   — Essential command binaries (ls, cp, mv)
  /etc   — Configuration files for the system
  /home  — User home directories (e.g. /home/ubuntu)
  /var   — Variable data like logs (/var/log)
  /tmp   — Temporary files cleared on reboot
  /usr   — User programs and utilities
  /root  — Home directory for the root user
  /proc  — Virtual filesystem showing running processes

WHY LINUX FOR SERVERS?
Linux is preferred for servers because it is stable and rarely needs rebooting, it is free and open source with no licensing costs, it offers fine-grained control over every system component, it has excellent security with user permissions and firewall tools, and it runs efficiently even on minimal hardware.

GETTING STARTED
When you SSH into a Linux server you land in a shell — usually Bash. The shell interprets your commands and communicates with the kernel. Every command you type is a program stored somewhere on the filesystem. For example when you type "ls", the shell finds /bin/ls and runs it.

KEY CONCEPT — Everything in Linux is a file. Devices, processes, network sockets — they are all represented as files. This is what makes Linux so powerful and consistent to work with.`,1],

      ['linux','Essential Bash Commands',
`Bash (Bourne Again SHell) is the default shell on most Linux systems. Mastering these commands will make you productive on any Linux server.

NAVIGATION COMMANDS
  pwd              — Print working directory (where you are)
  ls               — List files and directories
  ls -la           — List all files including hidden, with details
  cd /var/www      — Change to a specific directory
  cd ..            — Go up one directory level
  cd ~             — Go to your home directory

FILE OPERATIONS
  touch file.txt         — Create an empty file
  mkdir myfolder         — Create a new directory
  mkdir -p a/b/c         — Create nested directories
  cp file.txt backup.txt — Copy a file
  mv file.txt /tmp/      — Move or rename a file
  rm file.txt            — Delete a file
  rm -rf myfolder        — Delete a directory and all contents (use carefully!)
  cat file.txt           — Display file contents
  nano file.txt          — Edit a file in nano editor

SEARCHING AND FILTERING
  grep "error" logfile.txt        — Search for text in a file
  grep -r "error" /var/log/       — Search recursively in a directory
  find / -name "*.log"            — Find files by name
  tail -f /var/log/syslog         — Watch a log file in real time

PERMISSIONS AND OWNERSHIP
  chmod 400 key.pem     — Read only by owner (SSH key permission)
  chmod 755 script.sh   — Read/execute by all, write by owner
  chown ubuntu:ubuntu file.txt    — Change file owner and group
  chown -R ubuntu /var/www/       — Change ownership recursively

SYSTEM INFORMATION
  top / htop     — View running processes and resource usage
  df -h          — Check disk space usage
  free -h        — Check memory usage
  uptime         — See how long the server has been running
  whoami         — Show current logged-in user

PIPES AND REDIRECTION
  ls -la | grep ".sh"          — Pipe output from one command to another
  cat file.txt | wc -l         — Count lines in a file
  echo "hello" > output.txt    — Write output to a file (overwrites)
  echo "hello" >> output.txt   — Append output to a file`,2],

      ['linux','Writing Your First Shell Script',
`A shell script is a text file containing a series of bash commands that run in sequence. Scripts save time by automating repetitive tasks.

YOUR FIRST SCRIPT
Create a file called hello.sh:
  #!/bin/bash
  echo "Hello, World!"
  echo "Today is: $(date)"
  echo "You are logged in as: $(whoami)"

The first line #!/bin/bash is called a shebang — it tells the system to use bash to run this script.

Make it executable and run it:
  chmod +x hello.sh
  ./hello.sh

VARIABLES
  NAME="LearnHub"
  echo "Welcome to $NAME"

  AGE=3
  echo "Version: $AGE"

USER INPUT
  echo "Enter your name:"
  read USERNAME
  echo "Hello, $USERNAME!"

IF/ELSE CONDITIONS
  DISK=$(df / | grep / | awk '{print $5}' | sed 's/%//')
  if [ $DISK -gt 80 ]; then
    echo "WARNING: Disk usage is high at $DISK%"
  else
    echo "Disk usage is OK at $DISK%"
  fi

FOR LOOPS
  for i in 1 2 3 4 5; do
    echo "Count: $i"
  done

WHILE LOOPS
  COUNT=0
  while [ $COUNT -lt 5 ]; do
    echo "Count is $COUNT"
    COUNT=$((COUNT + 1))
  done

FUNCTIONS
  greet() {
    echo "Hello, $1!"
  }
  greet "Barnie"
  greet "LearnHub"

PRACTICAL EXAMPLE — Health Check Script
  #!/bin/bash
  DATE=$(date +%Y-%m-%d_%H:%M)
  echo "===== System Health Check: $DATE ====="
  echo "Disk Usage:"
  df -h /
  echo "Memory:"
  free -h
  echo "Top Processes:"
  ps aux --sort=-%cpu | head -5
  echo "========================================="

Save this as health.sh, chmod +x health.sh, then add it to cron to run automatically every hour.`,3],

      ['aws','AWS Global Infrastructure',
`Amazon Web Services operates a massive global network of data centers designed for high availability, low latency and fault tolerance.

KEY CONCEPTS

REGIONS
A Region is a geographic area where AWS has data centers. Examples include:
  eu-central-1  — Frankfurt, Germany
  eu-west-1     — Ireland
  us-east-1     — Northern Virginia, USA
  ap-southeast-1 — Singapore

Your EC2 instance runs in eu-central-1 (Frankfurt). Each region is completely independent. Resources in one region are not automatically replicated to another.

AVAILABILITY ZONES (AZs)
Each Region contains multiple Availability Zones — physically separate data centers within the same region, connected by high-speed private links. For example eu-central-1 has three AZs: eu-central-1a, eu-central-1b, eu-central-1c. Deploying across multiple AZs protects your application from a single data center failure.

EDGE LOCATIONS
Edge Locations are smaller AWS points of presence located in cities worldwide. They are used by CloudFront (CDN) to cache and deliver content to users with low latency. There are over 400 Edge Locations globally — many more than Regions.

HOW THIS AFFECTS YOUR LEARNHUB APP
Your LearnHub app runs on a single EC2 instance in eu-central-1. For a production application you would deploy across multiple AZs with a load balancer, use RDS in Multi-AZ mode for the database, and use CloudFront to serve static assets from Edge Locations close to your users.

CHOOSING A REGION
Choose a region close to your users for lower latency, check that the services you need are available in that region, and consider data residency laws (GDPR requires EU data to stay in the EU).`,1],

      ['aws','Launching Your First EC2 Instance',
`EC2 (Elastic Compute Cloud) is AWS's virtual machine service. You have already done this — your LearnHub app runs on an EC2 instance. Here is a detailed breakdown of every decision you make when launching one.

STEP 1 — CHOOSE AN AMI
An AMI (Amazon Machine Image) is a pre-built operating system template. Common choices:
  Amazon Linux 2023  — AWS's own Linux, great for AWS tools, SSH user: ec2-user
  Ubuntu 22.04/24.04 — Popular, large community, SSH user: ubuntu (your current choice)
  Windows Server     — For .NET applications, connect via RDP

STEP 2 — CHOOSE AN INSTANCE TYPE
Instance types define CPU, RAM and network capacity:
  t3.micro   — 2 vCPU, 1GB RAM  — Free tier eligible, good for testing
  t3.small   — 2 vCPU, 2GB RAM  — Small web apps
  t3.medium  — 2 vCPU, 4GB RAM  — Medium workloads
  m5.large   — 2 vCPU, 8GB RAM  — Production web servers

STEP 3 — CONFIGURE NETWORKING
  VPC            — Virtual Private Cloud, your isolated network
  Subnet         — Public subnet for internet-facing servers
  Public IP      — Enable for internet access
  Elastic IP     — Static IP that survives stop/start (you have this configured)

STEP 4 — SECURITY GROUPS
Security Groups are virtual firewalls. Common inbound rules:
  SSH    Port 22    — Your IP only (for security)
  HTTP   Port 80    — 0.0.0.0/0 (public web traffic)
  HTTPS  Port 443   — 0.0.0.0/0 (secure web traffic)
  Custom Port 4000  — Your app port

STEP 5 — KEY PAIR
A key pair consists of a public key stored by AWS and a private key (.pem file) you download. You use the .pem file to SSH in. You have techcrushkp.pem for your instance. Never share or lose this file.

STEP 6 — STORAGE
The root volume is an EBS (Elastic Block Store) disk. Default is 8GB for Linux. Data persists when you stop the instance but is lost if you terminate it. Always take snapshots of important data.

CONNECTING TO YOUR INSTANCE
  ssh -i ~/.ssh/techcrushkp.pem ubuntu@YOUR_PUBLIC_IP`,2],

      ['aws','S3 Storage & Bucket Policies',
`Amazon S3 (Simple Storage Service) is AWS's object storage service. It stores files called objects inside containers called buckets. S3 is ideal for storing backups, static website files, database dumps, logs and media files.

KEY CONCEPTS
  Bucket    — A container for objects. Bucket names must be globally unique across all AWS accounts.
  Object    — Any file stored in S3 (images, backups, logs, zip files).
  Key       — The full path/name of an object within a bucket e.g. backups/2026/db-backup.sql.gz
  Region    — Buckets are created in a specific region. Store data close to your EC2 for speed.

CREATING A BUCKET (AWS CLI)
  aws s3 mb s3://learnhub-backups --region eu-central-1

UPLOADING FILES
  aws s3 cp backup.sql.gz s3://learnhub-backups/
  aws s3 cp /var/log/nginx/ s3://learnhub-backups/logs/ --recursive

LISTING AND DOWNLOADING
  aws s3 ls s3://learnhub-backups/
  aws s3 cp s3://learnhub-backups/backup.sql.gz ./

BUCKET POLICIES
Bucket policies control who can access your bucket. A public read policy:
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }]
  }

VERSIONING
Enable versioning to keep multiple versions of every object — great for backups:
  aws s3api put-bucket-versioning --bucket learnhub-backups --versioning-configuration Status=Enabled

PRACTICAL USE — AUTOMATED BACKUPS TO S3
Add this to your Oracle backup script to send dumps directly to S3:
  aws s3 cp /home/oracle/backups/ s3://learnhub-backups/oracle/ --recursive
  echo "Backup uploaded to S3 at $(date)"

S3 STORAGE CLASSES
  Standard          — Frequently accessed data
  Standard-IA       — Infrequently accessed, lower cost
  Glacier           — Long-term archival, very cheap, slow retrieval
  Intelligent-Tiering — Automatically moves data between tiers based on access patterns`,3],

      ['azure','Azure vs AWS — Key Differences',
`Microsoft Azure and Amazon AWS are the two largest cloud providers. Understanding how they map to each other is essential for any cloud engineer.

SERVICE COMPARISON TABLE

COMPUTE
  AWS EC2                →  Azure Virtual Machines
  AWS Lambda             →  Azure Functions
  AWS ECS/EKS            →  Azure Container Instances / AKS
  AWS Elastic Beanstalk  →  Azure App Service

STORAGE
  AWS S3                 →  Azure Blob Storage
  AWS EBS                →  Azure Managed Disks
  AWS EFS                →  Azure Files
  AWS Glacier            →  Azure Archive Storage

NETWORKING
  AWS VPC                →  Azure Virtual Network (VNet)
  AWS Route 53           →  Azure DNS
  AWS CloudFront         →  Azure CDN
  AWS ELB                →  Azure Load Balancer

DATABASES
  AWS RDS                →  Azure Database for PostgreSQL/MySQL
  AWS DynamoDB           →  Azure Cosmos DB
  AWS ElastiCache        →  Azure Cache for Redis

IDENTITY & SECURITY
  AWS IAM                →  Azure Active Directory (AAD) / Entra ID
  AWS Security Groups    →  Azure Network Security Groups (NSGs)
  AWS KMS                →  Azure Key Vault

KEY TERMINOLOGY DIFFERENCES
  AWS Region             =  Azure Region (same concept)
  AWS Availability Zone  =  Azure Availability Zone
  AWS Security Group     =  Azure NSG (Network Security Group)
  AWS IAM Role           =  Azure Managed Identity
  AWS CloudWatch         =  Azure Monitor

PRICING MODEL
Both use pay-as-you-go pricing. Azure gives a 5% discount if you pay monthly upfront. AWS Reserved Instances offer up to 72% discount for 1-3 year commitments. Azure Hybrid Benefit lets you use existing Windows Server licences on Azure VMs.

WHICH SHOULD YOU LEARN?
Both are valuable. AWS has the largest market share (~33%). Azure is dominant in enterprises already using Microsoft products. Many companies use both — being skilled in both makes you highly employable.`,1],

      ['azure','Azure Virtual Machines',
`Azure Virtual Machines (VMs) are the equivalent of AWS EC2 instances. They are on-demand, scalable computing resources running in Microsoft's data centers.

CREATING AN AZURE VM
You can create VMs through the Azure Portal, Azure CLI, or ARM/Bicep templates.

Using Azure CLI:
  az vm create \
    --resource-group MyResourceGroup \
    --name MyVM \
    --image Ubuntu2204 \
    --admin-username azureuser \
    --generate-ssh-keys

RESOURCE GROUPS
Unlike AWS where resources are organized by region, Azure uses Resource Groups — logical containers that hold related resources. Everything for LearnHub (VM, disk, network) would go in one resource group for easy management and deletion.

VM SIZES (equivalent to AWS instance types)
  Standard_B1s    — 1 vCPU, 1GB RAM   — Testing (similar to t3.micro)
  Standard_B2s    — 2 vCPU, 4GB RAM   — Small apps
  Standard_D2s_v3 — 2 vCPU, 8GB RAM   — Production workloads
  Standard_D4s_v3 — 4 vCPU, 16GB RAM  — Medium workloads

NETWORKING IN AZURE
  VNet (Virtual Network) — Equivalent to AWS VPC
  Subnet                 — Subdivisions within a VNet
  NSG (Network Security Group) — Equivalent to AWS Security Groups
  Public IP Address      — Static or dynamic public IP
  NIC (Network Interface Card) — Connects VM to the VNet

CONNECTING VIA SSH
  ssh -i ~/.ssh/azure_key.pem azureuser@YOUR_PUBLIC_IP

AZURE DISKS (equivalent to AWS EBS)
  OS Disk     — Root volume, created automatically with VM
  Data Disk   — Additional disks you attach for extra storage
  Ultra Disk  — High performance for databases

STOPPING VS DEALLOCATING
This is a key Azure concept. Simply "stopping" a VM still charges for compute. You must DEALLOCATE the VM to stop billing — equivalent to AWS Stop Instance. This is what you asked about earlier in your AWS learning!

  az vm deallocate --resource-group MyRG --name MyVM`,2],

      ['azure','Azure Blob Storage',
`Azure Blob Storage is Microsoft's object storage service — the equivalent of Amazon S3. It is designed to store massive amounts of unstructured data such as text, images, videos, backups and logs.

KEY CONCEPTS
  Storage Account  — Top-level container (like an AWS account-level S3 namespace)
  Container        — Equivalent to an S3 bucket
  Blob             — The actual file/object stored
  Access Tier      — Hot, Cool or Archive (like S3 storage classes)

BLOB TYPES
  Block Blob  — For text and binary files (most common — use for backups, images, logs)
  Append Blob — Optimised for append operations (great for log files)
  Page Blob   — For random read/write operations (used for VM disks)

CREATING A STORAGE ACCOUNT AND CONTAINER (Azure CLI)
  az storage account create \
    --name learnhubstorage \
    --resource-group MyResourceGroup \
    --location westeurope \
    --sku Standard_LRS

  az storage container create \
    --name backups \
    --account-name learnhubstorage

UPLOADING AND DOWNLOADING BLOBS
  az storage blob upload \
    --container-name backups \
    --name db-backup.sql.gz \
    --file ./db-backup.sql.gz \
    --account-name learnhubstorage

  az storage blob download \
    --container-name backups \
    --name db-backup.sql.gz \
    --file ./restored-backup.sql.gz \
    --account-name learnhubstorage

ACCESS TIERS
  Hot     — Frequently accessed data. Higher storage cost, lower access cost.
  Cool    — Infrequently accessed data. Lower storage cost, higher access cost.
  Archive — Rarely accessed data. Lowest cost but takes hours to retrieve (rehydration).

SAS TOKENS (Shared Access Signatures)
SAS tokens give temporary, limited access to blobs without exposing your account key. Useful for sharing files securely:
  az storage blob generate-sas \
    --container-name backups \
    --name db-backup.sql.gz \
    --permissions r \
    --expiry 2026-12-31 \
    --account-name learnhubstorage

LIFECYCLE MANAGEMENT
Automatically move blobs between tiers or delete them after a set number of days — great for managing old backups and reducing costs.`,3],

      ['docker','What is Docker?',
`Docker is a platform for packaging and running applications in isolated environments called containers. It solves the classic "it works on my machine" problem by ensuring your app runs the same way everywhere.

CONTAINERS VS VIRTUAL MACHINES
Virtual Machines virtualise the entire hardware including a full OS — they are heavy and take minutes to start. Containers share the host OS kernel but isolate the application and its dependencies — they are lightweight and start in seconds.

  VM:        App + Full OS + Virtual Hardware   (~GBs, minutes to start)
  Container: App + Dependencies only            (~MBs, seconds to start)

CORE DOCKER CONCEPTS

IMAGE
A Docker image is a read-only template that contains your application and everything it needs to run (OS layer, runtime, libraries, code). Images are built from a Dockerfile. Your LearnHub image is called learnhubimage.

CONTAINER
A container is a running instance of an image. You can run multiple containers from the same image. Each container is isolated from others and from the host.

DOCKERFILE
A text file with instructions to build an image. Your LearnHub Dockerfile:
  FROM node:18          — Start from the official Node.js 18 image
  WORKDIR /learnhub-app — Set the working directory inside the container
  COPY package*.json ./ — Copy package files first (for layer caching)
  RUN npm install       — Install dependencies
  COPY . .              — Copy all app files
  EXPOSE 4000           — Document that the app uses port 4000
  CMD ["node","learnhub.js"] — Command to start the app

REGISTRY
A registry stores and distributes Docker images. Docker Hub is the public registry. You can push your learnhubimage to Docker Hub so it can be pulled and run anywhere.

ESSENTIAL DOCKER COMMANDS
  docker build -t myapp:latest .    — Build an image from Dockerfile
  docker run -d -p 4000:4000 myapp  — Run a container in background
  docker ps                         — List running containers
  docker ps -a                      — List all containers
  docker stop lms                   — Stop a container
  docker start lms                  — Start a stopped container
  docker rm lms                     — Remove a container
  docker images                     — List all images
  docker logs lms                   — View container logs
  docker exec -it lms bash          — Open a shell inside a container`,1],

      ['docker','Writing a Dockerfile',
`A Dockerfile is a recipe for building a Docker image. Every line creates a new layer in the image. Understanding each instruction helps you write efficient, production-ready Dockerfiles.

DOCKERFILE INSTRUCTIONS

FROM
Specifies the base image to start from. Always the first instruction.
  FROM node:18           — Official Node.js 18 on Debian
  FROM node:18-alpine    — Smaller Alpine Linux version (recommended for production)
  FROM ubuntu:24.04      — Plain Ubuntu base

WORKDIR
Sets the working directory inside the container for all subsequent instructions.
  WORKDIR /app

COPY
Copies files from your local machine into the image.
  COPY package*.json ./   — Copy package.json and package-lock.json
  COPY . .                — Copy everything else

RUN
Executes a command during the build process. Used to install dependencies.
  RUN npm install
  RUN apt-get update && apt-get install -y curl

EXPOSE
Documents which port the application listens on. Does not actually publish the port.
  EXPOSE 4000

ENV
Sets environment variables inside the container.
  ENV NODE_ENV=production
  ENV PORT=4000

CMD vs ENTRYPOINT
CMD sets the default command to run when the container starts.
  CMD ["node","learnhub.js"]    — JSON array format (recommended)
  CMD node learnhub.js          — Shell format (not recommended — poor signal handling)

ENTRYPOINT is similar but cannot be overridden as easily. Use CMD for flexibility.

LAYER CACHING — IMPORTANT OPTIMISATION
Docker caches each layer. If a layer hasn't changed it reuses the cache. This is why you should copy package.json BEFORE copying your source code:

  COPY package*.json ./   ← Only reinstalls if package.json changes
  RUN npm install
  COPY . .                ← Source changes don't trigger npm install again

YOUR LEARNHUB DOCKERFILE (optimised)
  FROM node:18-alpine
  WORKDIR /learnhub-app
  COPY package*.json ./
  RUN npm install --production
  COPY . .
  EXPOSE 4000
  CMD ["node","learnhub.js"]

.DOCKERIGNORE FILE
Create a .dockerignore file to exclude files from being copied into the image:
  node_modules
  .git
  *.log
  .env`,2],

      ['docker','Docker Compose & Networking',
`Docker Compose lets you define and run multi-container applications using a single YAML file. Instead of running long docker run commands, you describe your entire stack in docker-compose.yml.

WHY DOCKER COMPOSE?
Your LearnHub app currently needs three components: the Node.js app, PostgreSQL and Redis. Running each separately with long docker run commands is tedious. Docker Compose manages them all together.

EXAMPLE docker-compose.yml FOR LEARNHUB
  version: "3.9"
  services:
    app:
      build: .
      ports:
        - "4000:4000"
      environment:
        - DB_HOST=postgres
        - REDIS_HOST=redis
      depends_on:
        - postgres
        - redis

    postgres:
      image: postgres:16
      environment:
        POSTGRES_DB: learnhub
        POSTGRES_USER: learnhubuser
        POSTGRES_PASSWORD: LearnHub@123
      volumes:
        - pgdata:/var/lib/postgresql/data

    redis:
      image: redis:7-alpine
      volumes:
        - redisdata:/data

  volumes:
    pgdata:
    redisdata:

DOCKER COMPOSE COMMANDS
  docker compose up -d        — Start all services in background
  docker compose down         — Stop and remove all containers
  docker compose logs app     — View logs for the app service
  docker compose ps           — List running services
  docker compose build        — Rebuild images
  docker compose restart app  — Restart a single service

DOCKER NETWORKING
When containers are in the same Compose file they can reach each other by service name. The app container connects to postgres using the hostname "postgres" — not localhost or an IP address. This is Docker's internal DNS.

VOLUMES
Volumes persist data beyond the container lifecycle. Without a volume your PostgreSQL data would be lost every time you run docker compose down. The pgdata volume above keeps your database safe.

ENVIRONMENT VARIABLES
Use a .env file to store sensitive values:
  DB_PASSWORD=LearnHub@123
  REDIS_PASSWORD=secret

Reference in docker-compose.yml:
  environment:
    - DB_PASSWORD=\${DB_PASSWORD}`,3],

      ['nodejs','Node.js Event Loop',
`Node.js is a JavaScript runtime built on Chrome's V8 engine. It uses an event-driven, non-blocking I/O model that makes it lightweight and efficient for building web servers and APIs.

WHY NODE.JS IS DIFFERENT
Traditional web servers like Apache create a new thread for every incoming request. With thousands of simultaneous users this becomes expensive. Node.js uses a single thread with an event loop to handle thousands of concurrent connections efficiently.

THE EVENT LOOP
The event loop is the core of Node.js. It continuously checks if there are tasks to execute:
  1. Execute synchronous code (call stack)
  2. Process microtasks (Promises)
  3. Process macrotasks (setTimeout, I/O callbacks)
  4. Repeat

SYNCHRONOUS vs ASYNCHRONOUS

Synchronous (blocking) — BAD for servers:
  const data = fs.readFileSync('file.txt');  // Blocks everything until file is read
  console.log(data);

Asynchronous (non-blocking) — GOOD:
  fs.readFile('file.txt', (err, data) => {   // Node continues while file is read
    console.log(data);
  });

CALLBACKS
The original async pattern — a function passed as an argument to be called when the operation completes:
  setTimeout(() => {
    console.log('This runs after 2 seconds');
  }, 2000);
  console.log('This runs immediately');

PROMISES
A cleaner way to handle async operations:
  fetch('https://api.example.com/data')
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => console.error(error));

ASYNC/AWAIT (modern — used in LearnHub v3.0)
The cleanest way to write async code — looks synchronous but isn't blocking:
  async function getUser(id) {
    try {
      const result = await db.query('SELECT * FROM users WHERE id=$1', [id]);
      return result.rows[0];
    } catch (error) {
      console.error('Database error:', error);
    }
  }

LearnHub's entire server uses async/await for all database and Redis operations. Every route handler is an async function that awaits database queries without blocking other users' requests.`,1],

      ['nodejs','Building a REST API',
`A REST API (Representational State Transfer) is a way for clients (browsers, mobile apps) to communicate with a server using HTTP methods. LearnHub itself is a REST API — browsers make GET and POST requests to the Node.js server.

HTTP METHODS
  GET     — Retrieve data (read-only, no body)
  POST    — Create new data (sends data in request body)
  PUT     — Update existing data (full replacement)
  PATCH   — Partially update data
  DELETE  — Remove data

HTTP STATUS CODES
  200 OK           — Request succeeded
  201 Created      — Resource created successfully
  302 Found        — Redirect to another URL
  400 Bad Request  — Invalid request from client
  401 Unauthorized — Not logged in
  403 Forbidden    — Logged in but no permission
  404 Not Found    — Resource doesn't exist
  500 Server Error — Something went wrong on the server

BUILDING A SIMPLE API IN NODE.JS (no framework)
  const http = require('http');
  const url  = require('url');

  const server = http.createServer((req, res) => {
    const { pathname } = url.parse(req.url);

    if (req.method === 'GET' && pathname === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', app: 'LearnHub' }));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(4000);

LEARNHUB'S ROUTES
Your LearnHub app already implements several REST patterns:
  GET  /           — Serve home page
  GET  /courses    — List all courses
  POST /register   — Create a new user account
  POST /login      — Authenticate a user
  POST /enroll     — Enroll in a course
  GET  /dashboard  — Show user dashboard (protected route)
  GET  /logout     — Destroy session and redirect

REQUEST BODY PARSING
When a user submits a form, data is sent as application/x-www-form-urlencoded. LearnHub parses this manually with the parseBody() function. In production apps you would use a framework like Express which does this automatically with body-parser middleware.

RETURNING JSON (for frontend APIs)
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, user: { id: 1, name: 'Barnie' } }));`,2],

      ['nodejs','Connecting to PostgreSQL',
`Connecting Node.js to PostgreSQL is done using the pg library (node-postgres). LearnHub v3.0 uses this exact setup to store users, enrollments and quiz results.

INSTALLATION
  npm install pg

THE CONNECTION POOL
Instead of creating a new database connection for every request (slow and expensive), we use a connection pool — a set of reusable connections managed automatically.

  const { Pool } = require('pg');

  const db = new Pool({
    host:     'localhost',
    port:     5432,
    database: 'learnhub',
    user:     'learnhubuser',
    password: 'LearnHub@123',
  });

In LearnHub's Docker setup, host is 'host.docker.internal' because the app runs inside Docker but PostgreSQL runs on the host machine.

RUNNING QUERIES
  // Simple query
  const result = await db.query('SELECT * FROM users');
  console.log(result.rows);  // Array of row objects

  // Query with parameters (ALWAYS use $1,$2 — never string concatenation!)
  const user = await db.query(
    'SELECT * FROM users WHERE email = $1',
    ['barnie@example.com']
  );
  console.log(user.rows[0]);

PARAMETERISED QUERIES — CRITICAL FOR SECURITY
Never build SQL queries with string concatenation:
  // DANGEROUS — SQL Injection vulnerability!
  db.query("SELECT * FROM users WHERE email = '" + email + "'");

  // SAFE — Always use parameterised queries
  db.query('SELECT * FROM users WHERE email = $1', [email]);

INSERTING DATA AND RETURNING VALUES
  const result = await db.query(
    'INSERT INTO users(name, email, password) VALUES($1, $2, $3) RETURNING id',
    [name, email, hashedPassword]
  );
  const newUserId = result.rows[0].id;

LEARNHUB'S DATABASE TABLES
  users        — id, name, email, password, created_at
  enrollments  — id, user_id, course_id, enrolled_at
  quiz_results — id, user_id, score, total, taken_at
  lessons      — id, course_id, title, content, order_num

TRANSACTIONS (for operations that must succeed together)
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO orders ...');
    await client.query('UPDATE inventory ...');
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }`,3],

      ['security','SSH Hardening',
`SSH (Secure Shell) is the primary way to access Linux servers remotely. Securing SSH is one of the most important steps in server hardening. Poorly configured SSH is one of the most common attack vectors.

WHY SSH HARDENING MATTERS
Every server with port 22 open receives hundreds of automated login attempts (brute force attacks) every day. Without hardening, a weak password is all that stands between attackers and your server.

STEP 1 — USE KEY-BASED AUTHENTICATION ONLY
You already do this with techcrushkp.pem. Key-based auth is much stronger than passwords because the private key is mathematically impossible to brute-force.

Edit /etc/ssh/sshd_config:
  PasswordAuthentication no    — Disable password login
  PubkeyAuthentication yes     — Enable key-based login
  PermitRootLogin no           — Never allow root SSH login

Restart SSH:
  sudo systemctl restart sshd

STEP 2 — CHANGE THE DEFAULT SSH PORT
Changing from port 22 reduces automated scan noise. Use a port above 1024 e.g. 2222:
  Port 2222

Then connect with:
  ssh -i key.pem -p 2222 ubuntu@YOUR_IP

Also update your AWS Security Group to allow port 2222 instead of 22.

STEP 3 — INSTALL FAIL2BAN
Fail2ban monitors log files and automatically blocks IPs that have too many failed login attempts:
  sudo apt install fail2ban
  sudo systemctl enable fail2ban
  sudo systemctl start fail2ban

Check blocked IPs:
  sudo fail2ban-client status sshd

STEP 4 — LIMIT SSH ACCESS BY IP
In your AWS Security Group, restrict SSH (port 22) source to YOUR IP only instead of 0.0.0.0/0. This means only your IP can attempt SSH connections.

STEP 5 — KEEP SYSTEM UPDATED
  sudo apt update && sudo apt upgrade -y

Unpatched software is one of the biggest security risks. Set up automatic security updates:
  sudo apt install unattended-upgrades
  sudo dpkg-reconfigure unattended-upgrades

STEP 6 — MONITOR LOGIN ATTEMPTS
  sudo tail -f /var/log/auth.log        — Watch SSH login attempts in real time
  sudo grep "Failed password" /var/log/auth.log | tail -20  — See recent failures`,1],

      ['security','Linux File Permissions',
`Linux file permissions control who can read, write and execute files. Understanding permissions is essential for server security and is something you have already used — chmod 400 on your SSH key.

THE PERMISSION MODEL
Every file and directory has three sets of permissions:
  Owner   — The user who owns the file
  Group   — Users in the file's group
  Others  — Everyone else

Each set has three permission bits:
  r — Read    (value: 4)
  w — Write   (value: 2)
  x — Execute (value: 1)

READING PERMISSIONS
When you run ls -la you see output like:
  -rwxr-xr-x  1 ubuntu ubuntu 1674 Apr 17 techcrushkp.pem

  - = file type (- for file, d for directory, l for symlink)
  rwx = owner permissions (read, write, execute)
  r-x = group permissions (read, execute — no write)
  r-x = others permissions (read, execute — no write)

CHMOD — CHANGING PERMISSIONS

Numeric (octal) mode — add the values together:
  chmod 400 key.pem      — r-------- owner read only (SSH key)
  chmod 644 index.html   — rw-r--r-- owner read/write, others read
  chmod 755 script.sh    — rwxr-xr-x owner full, others read/execute
  chmod 700 ~/.ssh       — rwx------ owner full, no one else

  Common values:
  4 = read only
  6 = read + write
  7 = read + write + execute

Symbolic mode:
  chmod +x script.sh     — Add execute for everyone
  chmod u+w file.txt     — Add write for owner only
  chmod o-r file.txt     — Remove read from others
  chmod g=rw file.txt    — Set group to read+write exactly

CHOWN — CHANGING OWNERSHIP
  chown ubuntu file.txt           — Change owner to ubuntu
  chown ubuntu:ubuntu file.txt    — Change owner and group
  chown -R ubuntu /var/www/       — Change recursively

SPECIAL PERMISSIONS
  SUID (4000) — Run file as its owner regardless of who executes it
  SGID (2000) — New files in directory inherit the directory's group
  Sticky Bit (1000) — Only file owner can delete files in directory (used on /tmp)

  chmod g+s /var/www/learnhub-app  — New files inherit group ownership`,2],

      ['cron','Understanding Cron Syntax',
`Cron is a time-based job scheduler built into Linux. It runs commands or scripts automatically at specified times. You have already used cron for your Oracle database backups.

THE CRON EXPRESSION
A cron expression has five fields separated by spaces:

  * * * * * command
  │ │ │ │ │
  │ │ │ │ └── Day of week (0-7, 0 and 7 = Sunday)
  │ │ │ └──── Month (1-12)
  │ │ └────── Day of month (1-31)
  │ └──────── Hour (0-23)
  └────────── Minute (0-59)

SPECIAL CHARACTERS
  *   — Any value (every minute/hour/day etc.)
  ,   — List of values  e.g. 1,3,5
  -   — Range of values e.g. 1-5
  /   — Step values     e.g. */15 (every 15 minutes)

COMMON EXAMPLES
  0 * * * *       — Every hour at minute 0
  0 0 * * *       — Every day at midnight
  0 8,17 * * *    — Every day at 8AM and 5PM (your Oracle backup schedule!)
  0 0 * * 0       — Every Sunday at midnight
  */15 * * * *    — Every 15 minutes
  0 0 1 * *       — First day of every month at midnight
  0 9 * * 1-5     — Weekdays at 9AM (Monday to Friday)
  30 6 * * 1      — Every Monday at 6:30AM

MANAGING CRONTABS
  crontab -e       — Edit your cron jobs (opens in editor)
  crontab -l       — List your current cron jobs
  crontab -r       — Remove all your cron jobs (careful!)

SYSTEM-WIDE CRON
  /etc/crontab              — System crontab (has extra user field)
  /etc/cron.d/              — Drop-in cron files
  /etc/cron.daily/          — Scripts that run daily
  /etc/cron.hourly/         — Scripts that run hourly

LOGGING CRON OUTPUT
By default cron output is emailed to the user. Redirect to a log file instead:
  0 8,17 * * * /home/oracle/backup.sh >> /home/oracle/backup.log 2>&1

  >>  — Append output to file
  2>&1 — Also capture error output

ENVIRONMENT IN CRON
Cron runs in a minimal environment — it does not load your .bashrc or .profile. Always use full paths in cron scripts:
  # Wrong
  0 * * * * expdp system/pass@db ...

  # Correct
  0 * * * * /u01/app/oracle/product/19c/dbhome_1/bin/expdp system/pass@db ...`,1],

      ['cron','Practical Cron Examples',
`This lesson covers real-world cron job scripts you can use directly on your EC2 server — the same techniques used to automate your Oracle backups.

EXAMPLE 1 — ORACLE DATABASE BACKUP (your current setup)
  #!/bin/bash
  DATE=$(date +%d%m%Y%H%M)
  export ORACLE_HOME=/u01/app/oracle/product/19c/dbhome_1
  export ORACLE_SID=abconsult
  export PATH=$ORACLE_HOME/bin:$PATH

  echo "================================="
  echo "Backup started: $(date)"
  expdp system/Habib_123@abconsultpdb \
    schemas=hms_abconsult \
    directory=dmpdir \
    dumpfile=hms_abconsult_\${DATE}evrn.dmp \
    logfile=hms_abconsult_\${DATE}evrn.log

  if [ $? -eq 0 ]; then
    echo "✅ Backup completed: $(date)"
  else
    echo "❌ Backup FAILED: $(date)"
  fi
  echo "================================="

Cron schedule (8AM and 5PM daily):
  0 8,17 * * * /home/oracle/oracle_backup.sh >> /home/oracle/backup_cron.log 2>&1

EXAMPLE 2 — SYSTEM HEALTH LOGGER
  #!/bin/bash
  echo "===== Health Check: $(date) ====="
  echo "--- Disk ---"
  df -h /
  echo "--- Memory ---"
  free -h
  echo "--- CPU Load ---"
  uptime
  echo "================================="

Cron schedule (every hour):
  0 * * * * /home/ubuntu/health_check.sh >> /home/ubuntu/health.log 2>&1

EXAMPLE 3 — DISK SPACE ALERT
  #!/bin/bash
  THRESHOLD=80
  USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')

  if [ "$USAGE" -gt "$THRESHOLD" ]; then
    echo "⚠️  ALERT: Disk at \${USAGE}% on $(hostname) at $(date)" >> /home/ubuntu/disk_alert.log
  fi

Cron schedule (every 30 minutes):
  */30 * * * * /home/ubuntu/disk_alert.sh

EXAMPLE 4 — LEARNHUB POSTGRESQL BACKUP
  #!/bin/bash
  DATE=$(date +%Y-%m-%d_%H%M)
  BACKUP_DIR=/home/ubuntu/pg_backups
  mkdir -p $BACKUP_DIR

  echo "Backing up LearnHub DB: $(date)"
  pg_dump -U learnhubuser -d learnhub > $BACKUP_DIR/learnhub_$DATE.sql

  if [ $? -eq 0 ]; then
    gzip $BACKUP_DIR/learnhub_$DATE.sql
    echo "✅ DB backup complete: learnhub_$DATE.sql.gz"
    # Delete backups older than 7 days
    find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
    echo "Old backups cleaned up."
  else
    echo "❌ Backup failed!"
  fi

Cron schedule (daily at 2AM):
  0 2 * * * /home/ubuntu/pg_backup.sh >> /home/ubuntu/pg_backup.log 2>&1

EXAMPLE 5 — LOG ROTATION (clean old logs)
  #!/bin/bash
  find /home/ubuntu/*.log -mtime +30 -delete
  echo "Old logs cleaned at $(date)"

Cron schedule (every Sunday at midnight):
  0 0 * * 0 /home/ubuntu/cleanup_logs.sh`,2],

      ['network','TCP/IP & DNS Fundamentals',
`Networking is the foundation of everything you do in the cloud. Understanding TCP/IP and DNS will help you troubleshoot connectivity issues and design better cloud architectures.

THE TCP/IP MODEL
TCP/IP is the suite of protocols that powers the internet. It has four layers:
  Application Layer  — HTTP, HTTPS, SSH, DNS, FTP
  Transport Layer    — TCP (reliable), UDP (fast, unreliable)
  Internet Layer     — IP addresses, routing
  Network Layer      — Ethernet, WiFi, physical transmission

IP ADDRESSES
An IP address identifies a device on a network. IPv4 uses 32 bits written as four octets:
  63.182.10.126 — Your EC2 instance's public IP
  172.31.40.109 — Your EC2 instance's private IP (inside AWS VPC)
  172.17.0.1    — Docker's internal gateway IP

PRIVATE IP RANGES (not routable on the internet)
  10.0.0.0/8       — Large private networks (AWS VPCs often use this)
  172.16.0.0/12    — Docker default network range
  192.168.0.0/16   — Home/office networks

SUBNETS AND CIDR NOTATION
CIDR (Classless Inter-Domain Routing) defines network ranges:
  172.31.0.0/16  — 65,536 IP addresses (/16 = 16 bits for network)
  172.31.0.0/24  — 256 IP addresses (/24 = 24 bits for network)
  172.31.0.0/32  — Single IP address

TCP vs UDP
  TCP (Transmission Control Protocol)
    — Reliable, ordered delivery
    — Connection-oriented (3-way handshake: SYN, SYN-ACK, ACK)
    — Used by: HTTP, HTTPS, SSH, PostgreSQL
    — Slower but guaranteed delivery

  UDP (User Datagram Protocol)
    — Fast, no guarantee of delivery
    — No connection setup
    — Used by: DNS, video streaming, gaming
    — Faster but may lose packets

DNS — DOMAIN NAME SYSTEM
DNS translates human-readable domain names into IP addresses. When you type learnhub.com in a browser:
  1. Browser checks local cache
  2. Asks your ISP's DNS resolver
  3. Resolver asks root nameservers
  4. Root refers to .com nameservers
  5. .com refers to learnhub.com nameservers
  6. Returns IP address: 63.182.10.126
  7. Browser connects to that IP

COMMON DNS RECORD TYPES
  A     — Maps domain to IPv4 address (learnhub.com → 63.182.10.126)
  AAAA  — Maps domain to IPv6 address
  CNAME — Alias pointing to another domain
  MX    — Mail server records
  TXT   — Text records (used for domain verification)

USEFUL NETWORKING COMMANDS
  ping 63.182.10.126           — Test connectivity to a host
  traceroute google.com        — Show network path to a host
  nslookup learnhub.com        — DNS lookup
  dig learnhub.com             — Detailed DNS lookup
  netstat -tlnp                — Show listening ports
  ss -tlnp                     — Modern replacement for netstat
  curl -I http://localhost:4000 — Check HTTP response headers`,1],

      ['network','AWS VPC Deep Dive',
`A VPC (Virtual Private Cloud) is your own isolated network within AWS. When you launched your EC2 instance, it was placed inside a VPC automatically. Understanding VPCs is essential for building secure, scalable cloud architectures.

YOUR CURRENT SETUP
Your EC2 instance already lives in a VPC:
  Public IP:   63.182.10.126  — Accessible from the internet
  Private IP:  172.31.40.109  — Internal AWS network only
  Region:      eu-central-1 (Frankfurt)

VPC CORE COMPONENTS

VPC
The top-level network container. Your default VPC uses the CIDR range 172.31.0.0/16 giving you 65,536 private IP addresses.

SUBNETS
Subnets divide your VPC into smaller networks:
  Public Subnet   — Has a route to the internet via Internet Gateway. Your EC2 is here.
  Private Subnet  — No direct internet access. Databases should go here.

INTERNET GATEWAY (IGW)
Allows communication between your VPC and the internet. Without an IGW your EC2 would have no public internet access.

ROUTE TABLES
Define where network traffic goes:
  Destination    Target
  172.31.0.0/16  local          — Traffic within VPC stays local
  0.0.0.0/0      igw-xxxxxxxx   — Everything else goes to Internet Gateway

SECURITY GROUPS
Virtual firewalls at the instance level. You have configured these for your EC2:
  Inbound:  SSH (22), HTTP (80), Custom (4000)
  Outbound: All traffic allowed (default)

Security Groups are stateful — if you allow inbound port 4000, return traffic is automatically allowed.

NETWORK ACLS (NACLs)
Subnet-level firewall, stateless. Less commonly used than Security Groups but adds an extra layer of control.

NAT GATEWAY
Allows instances in private subnets to access the internet (for updates, downloads) without being directly accessible from the internet. Useful for database servers.

ELASTIC IP (you already have this!)
A static public IP associated with your instance. Without it your public IP changes every time you stop and start your instance.

RECOMMENDED ARCHITECTURE FOR LEARNHUB PRODUCTION
  Public Subnet:  EC2 (Node.js app), Nginx, Load Balancer
  Private Subnet: PostgreSQL RDS, Redis
  
  Internet → IGW → Public Subnet → EC2 → Private Subnet → DB

This ensures your database is never directly exposed to the internet.`,2],
    ];
    for (const [cid, title, content, order] of lessons) {
      await db.query(
        'INSERT INTO lessons (course_id,title,content,order_num) VALUES ($1,$2,$3,$4)',
        [cid, title, content, order]
      );
    }
    console.log('  ✅ Lessons seeded');
  }
}

// ─── SESSION HELPERS ──────────────────────────────────────────────────────────
function genToken() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

async function getSession(req) {
  const cookie = req.headers.cookie || '';
  const match  = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  try {
    const data = await redisClient.get('sess:' + match[1]);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

async function createSession(res, payload) {
  const token = genToken();
  await redisClient.setEx('sess:' + token, 86400, JSON.stringify(payload));
  res.setHeader('Set-Cookie', `session=${token}; Path=/; HttpOnly; Max-Age=86400`);
}

async function destroySession(req, res) {
  const cookie = req.headers.cookie || '';
  const match  = cookie.match(/session=([^;]+)/);
  if (match) await redisClient.del('sess:' + match[1]);
  res.setHeader('Set-Cookie', 'session=; Path=/; Max-Age=0');
}

// ─── BODY PARSER ─────────────────────────────────────────────────────────────
function parseBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const p = {};
      body.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k) p[decodeURIComponent(k)] = decodeURIComponent((v||'').replace(/\+/g,' '));
      });
      resolve(p);
    });
  });
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{
   --bg:#0f172a;--surface:#1e293b;--card:#1e3a5f;--card2:#263d5e;
    --accent:#38bdf8;--accent2:#818cf8;--green:#34d399;
    --gold:#fbbf24;--red:#f87171;--text:#e2e8f0;
    --muted:#94a3b8;--border:rgba(255,255,255,0.08);--border2:rgba(56,189,248,0.25);
  }
  html{scroll-behavior:smooth;}
  body{font-family:'Syne',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden;}
  body::after{content:'';position:fixed;inset:0;background:radial-gradient(ellipse 70% 50% at 50% 0%,rgba(79,156,249,0.04) 0%,transparent 70%);pointer-events:none;z-index:0;}
  nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:1rem 2.5rem;background:rgba(6,8,16,0.92);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);}
  .logo{font-family:'Instrument Serif',serif;font-size:1.6rem;color:var(--text);text-decoration:none;letter-spacing:-0.5px;}
  .logo span{color:var(--accent);font-style:italic;}
  nav ul{display:flex;gap:0.25rem;list-style:none;}
  nav a{color:var(--muted);text-decoration:none;font-size:0.85rem;font-weight:600;padding:0.5rem 1rem;border-radius:8px;transition:all 0.2s;}
  nav a:hover,nav a.active{color:var(--text);background:var(--card);}
  .nav-auth{display:flex;gap:0.75rem;align-items:center;}
  .btn{display:inline-flex;align-items:center;gap:0.4rem;padding:0.6rem 1.4rem;border-radius:8px;font-family:'Syne',sans-serif;font-size:0.85rem;font-weight:700;cursor:pointer;transition:all 0.2s;text-decoration:none;border:none;letter-spacing:0.3px;}
  .btn-primary{background:var(--accent);color:#fff;box-shadow:0 4px 16px rgba(79,156,249,0.3);}
  .btn-primary:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(79,156,249,0.4);}
  .btn-outline{background:transparent;color:var(--text);border:1px solid var(--border2);}
  .btn-outline:hover{background:var(--card);}
  .btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border);}
  .btn-ghost:hover{color:var(--text);border-color:var(--border2);}
  .btn-sm{padding:0.4rem 0.9rem;font-size:0.78rem;}
  .btn-green{background:var(--green);color:#000;}
  .btn-green:hover{transform:translateY(-1px);}
  .page{padding-top:5rem;min-height:100vh;position:relative;z-index:1;}
  .container{max-width:1200px;margin:0 auto;padding:0 2.5rem;}
  .section-label{font-size:0.7rem;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--accent);margin-bottom:0.75rem;}
  .section-title{font-family:'Instrument Serif',serif;font-size:clamp(2rem,4vw,3rem);letter-spacing:-1px;margin-bottom:2.5rem;line-height:1.1;}
  .tag{display:inline-block;font-size:0.7rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:0.25rem 0.65rem;border-radius:4px;margin-bottom:0.75rem;}
  footer{background:var(--surface);border-top:1px solid var(--border);padding:2rem 2.5rem;display:flex;align-items:center;justify-content:space-between;font-size:0.8rem;color:var(--muted);position:relative;z-index:1;}
  .server-badge{position:fixed;bottom:1.5rem;right:1.5rem;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:0.6rem 1rem;font-family:'DM Mono',monospace;font-size:0.7rem;color:var(--muted);z-index:200;display:flex;align-items:center;gap:0.5rem;}
  .dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:pulse 2s infinite;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
  .fade-up{animation:fadeUp 0.5s ease both;}
  .fade-up-1{animation:fadeUp 0.5s 0.1s ease both;}
  .fade-up-2{animation:fadeUp 0.5s 0.2s ease both;}
  .fade-up-3{animation:fadeUp 0.5s 0.3s ease both;}
  input,textarea{font-family:'Syne',sans-serif;}
  .form-group{display:flex;flex-direction:column;gap:0.5rem;}
  .form-label{font-size:0.78rem;font-weight:700;color:var(--muted);letter-spacing:0.5px;text-transform:uppercase;}
  .form-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:0.85rem 1rem;color:var(--text);font-size:0.9rem;outline:none;transition:border-color 0.2s;}
  .form-input:focus{border-color:var(--border2);}
  .alert{padding:0.85rem 1rem;border-radius:10px;font-size:0.85rem;margin-bottom:1.5rem;}
  .alert-error{background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.2);color:var(--red);}
  .alert-success{background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.2);color:var(--green);}
  .card{background:var(--card);border:1px solid var(--border);border-radius:16px;}
  .lock-banner{background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.2);border-radius:14px;padding:2.5rem;text-align:center;}
  @media(max-width:768px){nav{padding:1rem 1.25rem;}nav ul{display:none;}.container{padding:0 1.25rem;}.stats-float{display:none!important;}footer{flex-direction:column;gap:0.5rem;text-align:center;}}
`;

// ─── LAYOUT HELPERS ───────────────────────────────────────────────────────────
function navBar(active, loggedIn, username) {
  return `<nav>
    <a href="/" class="logo">Learn<span>Hub</span></a>
    <ul>
      <li><a href="/" class="${active==='home'?'active':''}">Home</a></li>
      <li><a href="/courses" class="${active==='courses'?'active':''}">Courses</a></li>
      <li><a href="/quiz" class="${active==='quiz'?'active':''}">Quiz</a></li>
      <li><a href="/resources" class="${active==='resources'?'active':''}">Resources</a></li>
      ${loggedIn?`<li><a href="/dashboard" class="${active==='dashboard'?'active':''}">Dashboard</a></li>`:''}
    </ul>
    <div class="nav-auth">
      ${loggedIn
        ? `<span style="color:var(--muted);font-size:0.82rem;">👋 ${username}</span><a href="/logout" class="btn btn-ghost">Logout</a>`
        : `<a href="/login" class="btn btn-ghost">Sign In</a><a href="/register" class="btn btn-primary">Register</a>`}
    </div>
  </nav>`;
}

function shell(title, body, active, loggedIn, username) {
  return `<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title} · LearnHub</title><style>${CSS}</style></head>
<body>
${navBar(active, loggedIn, username)}
${body}
<footer>
  <div>© 2026 LearnHub · Educational Portal</div>
  <div style="font-family:'DM Mono',monospace;font-size:0.72rem;">Node.js · PostgreSQL · Redis · Docker · AWS EC2</div>
</footer>
<div class="server-badge"><div class="dot"></div>EC2 · Docker · PG · Redis · :4000</div>
</body></html>`;
}

function inputField(name, label, type, placeholder) {
  return `<div class="form-group">
    <label class="form-label">${label}</label>
    <input class="form-input" name="${name}" type="${type}" placeholder="${placeholder}" required/>
  </div>`;
}

function alertBox(msg, type='error') {
  return `<div class="alert alert-${type}">${type==='error'?'⚠️':'✅'} ${msg}</div>`;
}

// ─── COURSE DATA ──────────────────────────────────────────────────────────────
const COURSES = [
  { id:'linux',    icon:'🐧', title:'Linux & Bash Scripting',   tag:'Linux',   tc:'rgba(79,156,249,0.1)',   tt:'var(--accent)',  level:'🟢 Beginner',     lessons:3, hours:4 },
  { id:'aws',      icon:'☁️', title:'AWS Cloud Fundamentals',   tag:'AWS',     tc:'rgba(251,191,36,0.1)',   tt:'var(--gold)',    level:'🟡 Intermediate', lessons:3, hours:6 },
  { id:'azure',    icon:'🔷', title:'Microsoft Azure Essentials',tag:'Azure',   tc:'rgba(167,139,250,0.1)', tt:'var(--accent2)', level:'🟡 Intermediate', lessons:3, hours:6 },
  { id:'nodejs',   icon:'🟨', title:'Node.js Backend Dev',      tag:'Dev',     tc:'rgba(52,211,153,0.1)',   tt:'var(--green)',   level:'🟡 Intermediate', lessons:3, hours:8 },
  { id:'docker',   icon:'🐳', title:'Docker & Containers',      tag:'DevOps',  tc:'rgba(79,156,249,0.1)',   tt:'var(--accent)',  level:'🟡 Intermediate', lessons:3, hours:5 },
  { id:'security', icon:'🔒', title:'Linux Server Security',    tag:'Security',tc:'rgba(248,113,113,0.1)',  tt:'var(--red)',     level:'🔴 Advanced',     lessons:2, hours:5 },
  { id:'cron',     icon:'⚙️', title:'Cron Jobs & Automation',   tag:'DevOps',  tc:'rgba(79,156,249,0.1)',   tt:'var(--accent)',  level:'🟢 Beginner',     lessons:2, hours:3 },
  { id:'network',  icon:'🌐', title:'Networking for DevOps',    tag:'Network', tc:'rgba(251,191,36,0.1)',   tt:'var(--gold)',    level:'🟢 Beginner',     lessons:2, hours:4 },
];

// ─── PAGE: HOME ───────────────────────────────────────────────────────────────
function homePage(loggedIn, username) {
  return shell('Home', `
  <div class="page">
    <section style="min-height:90vh;display:flex;align-items:center;padding:6rem 0 4rem;position:relative;overflow:hidden;">
      <div style="position:absolute;inset:0;background:radial-gradient(ellipse 60% 60% at 70% 50%,rgba(167,139,250,0.07) 0%,transparent 70%),radial-gradient(ellipse 40% 40% at 30% 60%,rgba(79,156,249,0.06) 0%,transparent 60%);"></div>
      <div class="container" style="position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:2rem;">
        <div style="max-width:650px;">
          <div class="fade-up" style="display:inline-flex;align-items:center;gap:0.5rem;background:rgba(79,156,249,0.08);border:1px solid rgba(79,156,249,0.2);color:var(--accent);font-size:0.72rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:0.4rem 1rem;border-radius:100px;margin-bottom:1.5rem;">
            🚀 AWS EC2 · Docker · PostgreSQL · Redis · Port 4000
          </div>
          <h1 class="fade-up-1" style="font-family:'Instrument Serif',serif;font-size:clamp(3.5rem,7vw,5.5rem);line-height:1.0;letter-spacing:-2px;margin-bottom:1.5rem;">Master Cloud &<br><em style="color:var(--accent);">DevOps</em> Skills</h1>
          <p class="fade-up-2" style="font-size:1.05rem;color:var(--muted);line-height:1.75;max-width:500px;margin-bottom:2.5rem;font-weight:400;">An interactive learning portal covering Linux, AWS, Azure, Node.js, Docker and more. Lessons are available to registered users.</p>
          <div class="fade-up-3" style="display:flex;gap:1rem;flex-wrap:wrap;">
            <a href="/courses" class="btn btn-primary" style="padding:0.85rem 2rem;font-size:0.95rem;">Browse Courses →</a>
            <a href="${loggedIn?'/dashboard':'/register'}" class="btn btn-outline" style="padding:0.85rem 2rem;font-size:0.95rem;">${loggedIn?'My Dashboard':'Join Free'}</a>
          </div>
        </div>
        <div class="stats-float" style="display:flex;flex-direction:column;gap:1rem;flex-shrink:0;">
          ${[['8','Courses'],['6','Quizzes'],['21','Lessons']].map(([n,l])=>`
          <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:1.25rem 1.75rem;text-align:center;min-width:130px;">
            <div style="font-family:'Instrument Serif',serif;font-size:2rem;color:var(--accent);line-height:1;">${n}</div>
            <div style="font-size:0.72rem;color:var(--muted);margin-top:0.2rem;">${l}</div>
          </div>`).join('')}
        </div>
      </div>
    </section>
    <section style="padding:5rem 0;background:var(--surface);">
      <div class="container">
        <div class="section-label">Why LearnHub</div>
        <div class="section-title">Everything you need to grow</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1.25rem;">
          ${[['⚡','Hands-on Lessons','Real content locked for registered users — not just theory.'],
             ['🧠','Knowledge Quizzes','Test yourself with instant feedback after every topic.'],
             ['☁️','Cloud-Focused','AWS, Azure, Linux, Docker — the stack that powers the world.'],
             ['🗄️','PostgreSQL + Redis','Your progress and sessions are stored in real databases.']
          ].map(([i,t,d])=>`
          <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:1.75rem;transition:border-color 0.2s;"
            onmouseover="this.style.borderColor='var(--border2)'" onmouseout="this.style.borderColor='var(--border)'">
            <div style="font-size:2rem;margin-bottom:1rem;">${i}</div>
            <div style="font-weight:700;margin-bottom:0.5rem;">${t}</div>
            <div style="font-size:0.85rem;color:var(--muted);line-height:1.6;">${d}</div>
          </div>`).join('')}
        </div>
      </div>
    </section>
    <section style="padding:5rem 0;">
      <div class="container" style="text-align:center;">
        <div style="background:linear-gradient(135deg,var(--card),var(--card2));border:1px solid var(--border2);border-radius:20px;padding:4rem 2rem;">
          <div style="font-family:'Instrument Serif',serif;font-size:clamp(2rem,4vw,3rem);margin-bottom:1rem;letter-spacing:-1px;">Ready to start learning?</div>
          <p style="color:var(--muted);margin-bottom:2rem;">Register free and unlock all lessons and courses instantly.</p>
          <a href="${loggedIn?'/dashboard':'/register'}" class="btn btn-primary" style="padding:0.9rem 2.5rem;font-size:1rem;">${loggedIn?'Go to Dashboard →':'Create Free Account →'}</a>
        </div>
      </div>
    </section>
  </div>`, 'home', loggedIn, username);
}

// ─── PAGE: COURSES ────────────────────────────────────────────────────────────
function coursesPage(loggedIn, username, enrolledIds=[]) {
  return shell('Courses', `
  <div class="page">
    <section style="padding:4rem 0;">
      <div class="container">
        <div class="section-label">All Courses</div>
        <div class="section-title">Build real-world skills</div>
        ${!loggedIn?`<div style="background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.2);border-radius:12px;padding:1rem 1.5rem;margin-bottom:2rem;font-size:0.9rem;color:var(--accent2);">
          🔒 <a href="/register" style="color:var(--accent2);font-weight:700;">Register</a> or <a href="/login" style="color:var(--accent2);font-weight:700;">sign in</a> to enroll and access lessons.
        </div>`:''}
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.5rem;">
          ${COURSES.map(c=>{
            const enrolled = enrolledIds.includes(c.id);
            return `
            <div style="background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden;transition:transform 0.3s,box-shadow 0.3s;"
              onmouseover="this.style.transform='translateY(-5px)';this.style.boxShadow='0 20px 40px rgba(0,0,0,0.3)'"
              onmouseout="this.style.transform='';this.style.boxShadow=''">
              <div style="height:130px;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:3.5rem;border-bottom:1px solid var(--border);">${c.icon}</div>
              <div style="padding:1.5rem;">
                <span class="tag" style="background:${c.tc};color:${c.tt};">${c.tag}</span>
                <div style="font-family:'Instrument Serif',serif;font-size:1.2rem;margin-bottom:0.5rem;line-height:1.3;">${c.title}</div>
                <div style="display:flex;align-items:center;justify-content:space-between;padding-top:1rem;border-top:1px solid var(--border);font-size:0.78rem;color:var(--muted);margin-bottom:1rem;">
                  <span>${c.level}</span><span>${c.lessons} lessons · ${c.hours}h</span>
                </div>
                ${loggedIn
                  ? enrolled
                    ? `<div style="display:flex;gap:0.5rem;">
                         <a href="/lessons/${c.id}" class="btn btn-green btn-sm" style="flex:1;justify-content:center;">📖 View Lessons</a>
                       </div>`
                    : `<form method="POST" action="/enroll">
                         <input type="hidden" name="course_id" value="${c.id}"/>
                         <button type="submit" class="btn btn-primary btn-sm" style="width:100%;justify-content:center;">Enroll Now</button>
                       </form>`
                  : `<a href="/register" class="btn btn-outline btn-sm" style="width:100%;justify-content:center;">🔒 Register to Enroll</a>`
                }
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>
  </div>`, 'courses', loggedIn, username);
}

// ─── PAGE: LESSONS ────────────────────────────────────────────────────────────
function lessonsPage(course, lessons, loggedIn, username) {
  return shell(course.title, `
  <div class="page">
    <section style="padding:4rem 0;">
      <div class="container">
        <a href="/courses" style="color:var(--muted);text-decoration:none;font-size:0.85rem;display:inline-flex;align-items:center;gap:0.4rem;margin-bottom:1.5rem;">← Back to Courses</a>
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.75rem;flex-wrap:wrap;">
          <span style="font-size:2.5rem;">${course.icon}</span>
          <div>
            <div class="section-label">${course.tag} Course</div>
            <div style="font-family:'Instrument Serif',serif;font-size:2rem;letter-spacing:-1px;">${course.title}</div>
          </div>
        </div>
        <p style="color:var(--muted);font-size:0.85rem;margin-bottom:2rem;">Click any lesson to expand and read the content.</p>
        <div style="display:flex;flex-direction:column;gap:0.75rem;">
          ${lessons.map((l,i)=>`
          <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden;transition:border-color 0.2s;" id="lesson-wrap-${i}">
            <!-- Header (clickable) -->
            <div onclick="toggleLesson(${i})" style="display:flex;align-items:center;gap:1rem;padding:1.25rem 1.5rem;cursor:pointer;user-select:none;"
              onmouseover="this.style.background='rgba(79,156,249,0.04)'" onmouseout="this.style.background=''">
              <div style="width:36px;height:36px;border-radius:10px;background:rgba(79,156,249,0.1);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:0.8rem;color:var(--accent);flex-shrink:0;">${String(i+1).padStart(2,'0')}</div>
              <div style="flex:1;font-weight:700;font-size:0.95rem;">${l.title}</div>
              <div id="arrow-${i}" style="color:var(--muted);font-size:0.85rem;transition:transform 0.3s;flex-shrink:0;">▼</div>
            </div>
            <!-- Content (hidden by default) -->
            <div id="lesson-content-${i}" style="display:none;padding:0 1.5rem 1.5rem;border-top:1px solid var(--border);">
              <div style="height:1rem;"></div>
              <div style="font-size:0.9rem;color:var(--muted);line-height:1.8;">${l.content}</div>
              <div style="margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:0.75rem;color:var(--muted);">Lesson ${i+1} of ${lessons.length}</span>
                ${i < lessons.length-1
                  ? `<button onclick="toggleLesson(${i+1});document.getElementById('lesson-wrap-${i+1}').scrollIntoView({behavior:'smooth'});toggleLesson(${i})" class="btn btn-primary btn-sm">Next Lesson →</button>`
                  : `<span style="font-size:0.75rem;color:var(--green);font-weight:700;">✅ Course Complete!</span>`
                }
              </div>
            </div>
          </div>`).join('')}
        </div>
      </div>
    </section>
  </div>
  <script>
  const total = ${lessons.length};
  function toggleLesson(i) {
    for (let j = 0; j < total; j++) {
      if (j !== i) {
        document.getElementById('lesson-content-' + j).style.display = 'none';
        document.getElementById('arrow-' + j).style.transform = '';
        document.getElementById('arrow-' + j).style.color = 'var(--muted)';
        document.getElementById('lesson-wrap-' + j).style.borderColor = 'var(--border)';
      }
    }
    const content = document.getElementById('lesson-content-' + i);
    const arrow   = document.getElementById('arrow-' + i);
    const wrap    = document.getElementById('lesson-wrap-' + i);
    const isOpen  = content.style.display === 'block';
    content.style.display  = isOpen ? 'none' : 'block';
    arrow.style.transform  = isOpen ? '' : 'rotate(180deg)';
    arrow.style.color      = isOpen ? 'var(--muted)' : 'var(--accent)';
    wrap.style.borderColor = isOpen ? 'var(--border)' : 'var(--border2)';
  }
  toggleLesson(0);
  </script>`, 'courses', loggedIn, username);
}

function lessonLockPage(loggedIn, username) {
  return shell('Lessons Locked', `
  <div class="page" style="display:flex;align-items:center;justify-content:center;padding:5rem 1.5rem;">
    <div style="max-width:500px;width:100%;">
      <div class="lock-banner">
        <div style="font-size:3rem;margin-bottom:1rem;">🔒</div>
        <div style="font-family:'Instrument Serif',serif;font-size:2rem;margin-bottom:0.75rem;">Lessons are for Members</div>
        <p style="color:var(--muted);margin-bottom:1.5rem;font-size:0.9rem;line-height:1.6;">Register for free to unlock all lessons, enroll in courses and track your progress.</p>
        <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;">
          <a href="/register" class="btn btn-primary">Register Free →</a>
          <a href="/login" class="btn btn-outline">Sign In</a>
        </div>
      </div>
    </div>
  </div>`, '', loggedIn, username);
}

// ─── PAGE: QUIZ ───────────────────────────────────────────────────────────────
function quizPage(loggedIn, username) {
  return shell('Quiz', `
  <div class="page">
    <section style="padding:4rem 0;">
      <div class="container">
        <div class="section-label">Test Your Knowledge</div>
        <div class="section-title">Quick Quiz</div>
        <div style="max-width:660px;margin:0 auto;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:2.5rem;">
          <div style="display:flex;align-items:center;gap:1rem;margin-bottom:2rem;">
            <div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
              <div id="pFill" style="height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));width:0%;transition:width 0.4s;border-radius:2px;"></div>
            </div>
            <div id="pText" style="font-size:0.78rem;color:var(--muted);font-family:'DM Mono',monospace;white-space:nowrap;">1 / 6</div>
          </div>
          <div id="qMain">
            <div id="qText" style="font-family:'Instrument Serif',serif;font-size:1.35rem;margin-bottom:1.5rem;line-height:1.4;"></div>
            <div id="qOpts" style="display:flex;flex-direction:column;gap:0.75rem;margin-bottom:1.5rem;"></div>
            <div id="qFeedback" style="display:none;padding:1rem 1.25rem;border-radius:10px;font-size:0.88rem;line-height:1.5;margin-bottom:1.5rem;"></div>
            <button id="nextBtn" onclick="nextQ()" style="display:none;" class="btn btn-primary">Next →</button>
          </div>
          <div id="qScore" style="display:none;text-align:center;">
            <div style="width:110px;height:110px;border-radius:50%;border:3px solid var(--accent);display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 1.5rem;">
              <div id="sNum" style="font-family:'Instrument Serif',serif;font-size:2.5rem;color:var(--accent);line-height:1;"></div>
              <div style="font-size:0.65rem;color:var(--muted);">SCORE</div>
            </div>
            <div id="sMsg" style="font-family:'Instrument Serif',serif;font-size:1.5rem;margin-bottom:0.5rem;"></div>
            <p style="color:var(--muted);font-size:0.85rem;margin-bottom:1.5rem;">Keep practising to master these topics!</p>
            ${loggedIn?`<p style="color:var(--green);font-size:0.82rem;margin-bottom:1rem;">✅ Your score has been saved to your dashboard.</p>`:''}
            <button onclick="restartQ()" class="btn btn-primary">Retake Quiz ↺</button>
          </div>
        </div>
      </div>
    </section>
  </div>
  <script>
  const qs=[
    {q:"Which Azure service is equivalent to AWS EC2?",opts:["Azure Blob Storage","Azure Virtual Machines","Azure Functions","Azure DevOps"],a:1,exp:"Azure Virtual Machines are Azure's IaaS compute service, equivalent to AWS EC2."},
    {q:"What does 'docker ps -a' show?",opts:["Only running containers","Only images","All containers including stopped ones","Container logs"],a:2,exp:"docker ps shows running containers only. docker ps -a shows ALL containers including stopped ones."},
    {q:"What does -R do in 'chown -R user /dir'?",opts:["Renames the directory","Applies ownership recursively to all contents","Removes the directory","Restores permissions"],a:1,exp:"-R applies the ownership change to the directory and all its contents recursively."},
    {q:"Correct JSON CMD format in a Dockerfile?",opts:['CMD node app.js','CMD = ["node","app.js"]','CMD ["node","app.js"]','RUN ["node","app.js"]'],a:2,exp:"JSON array format prevents shell wrapping and ensures proper OS signal handling on container stop."},
    {q:"Cron expression for 8AM and 5PM every day?",opts:["0 8,17 * * *","8,17 0 * * *","* 8 * * 17","0 8 * 17 *"],a:0,exp:"'0 8,17 * * *' means minute 0, hours 8 and 17, every day of month, every month, every weekday."},
    {q:"Which Azure service is equivalent to Amazon S3?",opts:["Azure Files","Azure Disk Storage","Azure Blob Storage","Azure Data Lake"],a:2,exp:"Azure Blob Storage is Azure's object storage service, equivalent to Amazon S3 for unstructured data."},
  ];
  const isLoggedIn = ${loggedIn};
  let cur=0,score=0,done=false;
  const letters=['A','B','C','D'];
  function loadQ(){
    const q=qs[cur];
    document.getElementById('qText').textContent=q.q;
    document.getElementById('pText').textContent=(cur+1)+' / '+qs.length;
    document.getElementById('pFill').style.width=((cur/qs.length)*100)+'%';
    document.getElementById('qFeedback').style.display='none';
    document.getElementById('nextBtn').style.display='none';
    done=false;
    const c=document.getElementById('qOpts'); c.innerHTML='';
    q.opts.forEach((o,i)=>{
      const b=document.createElement('button');
      b.style.cssText='background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:0.9rem 1.2rem;cursor:pointer;transition:all 0.2s;font-size:0.88rem;text-align:left;color:var(--text);display:flex;align-items:center;gap:0.75rem;width:100%;font-family:Syne,sans-serif;';
      b.innerHTML='<span style="width:26px;height:26px;border-radius:6px;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;flex-shrink:0;">'+letters[i]+'</span>'+o;
      b.onmouseover=()=>{if(!done)b.style.borderColor='var(--border2)';};
      b.onmouseout=()=>{if(!done)b.style.borderColor='var(--border)';};
      b.onclick=()=>pick(i);
      c.appendChild(b);
    });
  }
  function pick(sel){
    if(done)return; done=true;
    const q=qs[cur];
    const btns=document.querySelectorAll('#qOpts button');
    btns.forEach(b=>b.disabled=true);
    const fb=document.getElementById('qFeedback');
    if(sel===q.a){
      btns[sel].style.borderColor='var(--green)';btns[sel].style.background='rgba(52,211,153,0.08)';btns[sel].style.color='var(--green)';
      fb.style.cssText='display:block;padding:1rem 1.25rem;border-radius:10px;font-size:0.88rem;line-height:1.5;margin-bottom:1.5rem;background:rgba(52,211,153,0.08);color:var(--green);border:1px solid rgba(52,211,153,0.2);';
      fb.textContent='✅ Correct! '+q.exp; score++;
    } else {
      btns[sel].style.borderColor='var(--red)';btns[sel].style.background='rgba(248,113,113,0.08)';btns[sel].style.color='var(--red)';
      btns[q.a].style.borderColor='var(--green)';btns[q.a].style.background='rgba(52,211,153,0.08)';btns[q.a].style.color='var(--green)';
      fb.style.cssText='display:block;padding:1rem 1.25rem;border-radius:10px;font-size:0.88rem;line-height:1.5;margin-bottom:1.5rem;background:rgba(248,113,113,0.08);color:var(--red);border:1px solid rgba(248,113,113,0.2);';
      fb.textContent='❌ Not quite. '+q.exp;
    }
    document.getElementById('nextBtn').style.display='inline-flex';
  }
  function nextQ(){ cur++; if(cur>=qs.length) showScore(); else loadQ(); }
  async function showScore(){
    document.getElementById('qMain').style.display='none';
    document.getElementById('pFill').style.width='100%';
    document.getElementById('pText').textContent=qs.length+' / '+qs.length;
    document.getElementById('qScore').style.display='block';
    document.getElementById('sNum').textContent=score+'/'+qs.length;
    const msgs=['Keep studying! 📚','Good effort! 💪','Nice work! 🌟','Great job! 🎉','Almost perfect! ⭐','Perfect score! 🏆'];
    document.getElementById('sMsg').textContent=msgs[score]||msgs[0];
    if(isLoggedIn){
      await fetch('/save-quiz',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({score,total:qs.length})});
    }
  }
  function restartQ(){ cur=0;score=0;done=false; document.getElementById('qMain').style.display='block'; document.getElementById('qScore').style.display='none'; loadQ(); }
  loadQ();
  </script>`, 'quiz', loggedIn, username);
}

// ─── PAGE: RESOURCES ──────────────────────────────────────────────────────────
function resourcesPage(loggedIn, username) {
  const items = [
    {icon:'📘',title:'Linux Command Reference',type:'Cheat Sheet · PDF',cat:'Linux'},
    {icon:'🎥',title:'AWS EC2 Deep Dive',type:'Video Series · 3h 20m',cat:'AWS'},
    {icon:'🔷',title:'Azure VM Quickstart Guide',type:'Documentation',cat:'Azure'},
    {icon:'🐳',title:'Docker Official Docs',type:'Reference · Online',cat:'Docker'},
    {icon:'📝',title:'Cron Expression Builder',type:'Interactive Tool',cat:'DevOps'},
    {icon:'🔐',title:'SSH Security Hardening Guide',type:'Article · 15 min',cat:'Security'},
    {icon:'⚡',title:'Node.js Best Practices',type:'GitHub Repo',cat:'Node.js'},
    {icon:'☁️',title:'Azure vs AWS Comparison',type:'Reference Guide',cat:'Cloud'},
  ];
  return shell('Resources', `
  <div class="page">
    <section style="padding:4rem 0;">
      <div class="container">
        <div class="section-label">Learning Materials</div>
        <div class="section-title">Curated Resources</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem;">
          ${items.map(r=>`
          <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.5rem;display:flex;gap:1rem;align-items:flex-start;transition:border-color 0.2s;cursor:pointer;"
            onmouseover="this.style.borderColor='var(--border2)'" onmouseout="this.style.borderColor='var(--border)'">
            <div style="font-size:2rem;flex-shrink:0;">${r.icon}</div>
            <div>
              <div style="font-weight:700;margin-bottom:0.3rem;font-size:0.92rem;">${r.title}</div>
              <div style="font-size:0.75rem;color:var(--muted);">${r.type}</div>
              <span style="display:inline-block;margin-top:0.5rem;font-size:0.65rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:0.2rem 0.5rem;border-radius:4px;background:rgba(79,156,249,0.08);color:var(--accent);">${r.cat}</span>
            </div>
          </div>`).join('')}
        </div>
      </div>
    </section>
  </div>`, 'resources', loggedIn, username);
}

// ─── PAGE: REGISTER ───────────────────────────────────────────────────────────
function registerPage(error='') {
  return shell('Register', `
  <div class="page" style="display:flex;align-items:center;justify-content:center;padding:5rem 1.5rem;">
    <div style="width:100%;max-width:440px;">
      <div style="text-align:center;margin-bottom:2rem;">
        <div style="font-family:'Instrument Serif',serif;font-size:2.5rem;letter-spacing:-1px;margin-bottom:0.5rem;">Create Account</div>
        <p style="color:var(--muted);font-size:0.9rem;">Join free and unlock all lessons</p>
      </div>
      <div class="card" style="padding:2.5rem;">
        ${error ? alertBox(error) : ''}
        <form method="POST" action="/register" style="display:flex;flex-direction:column;gap:1.25rem;">
          ${inputField('name','Full Name','text','John Doe')}
          ${inputField('email','Email','email','john@example.com')}
          ${inputField('password','Password','password','Min 6 characters')}
          <button type="submit" class="btn btn-primary" style="width:100%;padding:0.9rem;justify-content:center;margin-top:0.5rem;">Create Account →</button>
        </form>
        <p style="text-align:center;margin-top:1.5rem;font-size:0.85rem;color:var(--muted);">Already have an account? <a href="/login" style="color:var(--accent);text-decoration:none;font-weight:700;">Sign In</a></p>
      </div>
    </div>
  </div>`, 'register', false, '');
}

// ─── PAGE: LOGIN ──────────────────────────────────────────────────────────────
function loginPage(error='') {
  return shell('Sign In', `
  <div class="page" style="display:flex;align-items:center;justify-content:center;padding:5rem 1.5rem;">
    <div style="width:100%;max-width:440px;">
      <div style="text-align:center;margin-bottom:2rem;">
        <div style="font-family:'Instrument Serif',serif;font-size:2.5rem;letter-spacing:-1px;margin-bottom:0.5rem;">Welcome Back</div>
        <p style="color:var(--muted);font-size:0.9rem;">Sign in to continue learning</p>
      </div>
      <div class="card" style="padding:2.5rem;">
        ${error ? alertBox(error) : ''}
        <form method="POST" action="/login" style="display:flex;flex-direction:column;gap:1.25rem;">
          ${inputField('email','Email','email','john@example.com')}
          ${inputField('password','Password','password','Your password')}
          <button type="submit" class="btn btn-primary" style="width:100%;padding:0.9rem;justify-content:center;margin-top:0.5rem;">Sign In →</button>
        </form>
        <p style="text-align:center;margin-top:1.5rem;font-size:0.85rem;color:var(--muted);">Don't have an account? <a href="/register" style="color:var(--accent);text-decoration:none;font-weight:700;">Register Free</a></p>
      </div>
    </div>
  </div>`, 'login', false, '');
}

// ─── PAGE: DASHBOARD ──────────────────────────────────────────────────────────
async function dashboardPage(session) {
  const { name, id } = session;
  const enrollRes  = await db.query('SELECT course_id FROM enrollments WHERE user_id=$1 ORDER BY enrolled_at DESC', [id]);
  const quizRes    = await db.query('SELECT score,total,taken_at FROM quiz_results WHERE user_id=$1 ORDER BY taken_at DESC LIMIT 5', [id]);
  const enrolled   = enrollRes.rows;
  const quizzes    = quizRes.rows;
  const avgScore   = quizzes.length ? Math.round(quizzes.reduce((s,r)=>s+(r.score/r.total*100),0)/quizzes.length) : 0;

  const enrolledCourses = enrolled.map(e => COURSES.find(c => c.id === e.course_id)).filter(Boolean);

  return shell('Dashboard', `
  <div class="page">
    <section style="padding:4rem 0;">
      <div class="container">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:2.5rem;flex-wrap:wrap;gap:1rem;">
          <div>
            <div class="section-label">My Dashboard</div>
            <div style="font-family:'Instrument Serif',serif;font-size:2.5rem;letter-spacing:-1px;">Welcome back, <em style="color:var(--accent);">${name}</em></div>
          </div>
          <a href="/courses" class="btn btn-primary">Browse Courses →</a>
        </div>

        <!-- Stats -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1.25rem;margin-bottom:3rem;">
          ${[
            [enrolled.length,'Courses Enrolled','var(--accent)'],
            [quizzes.length,'Quizzes Taken','var(--accent2)'],
            [avgScore+'%','Avg. Quiz Score','var(--green)'],
          ].map(([n,l,c])=>`
          <div class="card" style="padding:1.5rem;">
            <div style="font-family:'Instrument Serif',serif;font-size:2rem;color:${c};line-height:1;margin-bottom:0.3rem;">${n}</div>
            <div style="font-size:0.78rem;color:var(--muted);">${l}</div>
          </div>`).join('')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
          <!-- Enrolled Courses -->
          <div class="card" style="padding:2rem;">
            <div style="font-weight:700;margin-bottom:1.5rem;">📚 My Courses</div>
            ${enrolledCourses.length
              ? enrolledCourses.map(c=>`
                <div style="display:flex;align-items:center;justify-content:space-between;padding:0.85rem 0;border-bottom:1px solid var(--border);">
                  <div style="display:flex;align-items:center;gap:0.75rem;">
                    <span style="font-size:1.5rem;">${c.icon}</span>
                    <div>
                      <div style="font-size:0.88rem;font-weight:600;">${c.title}</div>
                      <div style="font-size:0.72rem;color:var(--muted);">${c.lessons} lessons</div>
                    </div>
                  </div>
                  <a href="/lessons/${c.id}" class="btn btn-green btn-sm">Open →</a>
                </div>`).join('')
              : `<div style="text-align:center;padding:2rem;color:var(--muted);">
                  <div style="font-size:2rem;margin-bottom:0.5rem;">📖</div>
                  <div style="font-size:0.85rem;">No courses yet. <a href="/courses" style="color:var(--accent);">Browse courses</a></div>
                </div>`
            }
          </div>

          <!-- Quiz History -->
          <div class="card" style="padding:2rem;">
            <div style="font-weight:700;margin-bottom:1.5rem;">🧠 Quiz History</div>
            ${quizzes.length
              ? quizzes.map(q=>{
                  const pct = Math.round(q.score/q.total*100);
                  const col = pct>=80?'var(--green)':pct>=50?'var(--gold)':'var(--red)';
                  return `<div style="display:flex;align-items:center;justify-content:space-between;padding:0.85rem 0;border-bottom:1px solid var(--border);">
                    <div>
                      <div style="font-size:0.88rem;font-weight:600;">${q.score}/${q.total} correct</div>
                      <div style="font-size:0.72rem;color:var(--muted);">${new Date(q.taken_at).toLocaleDateString()}</div>
                    </div>
                    <span style="font-family:'DM Mono',monospace;font-size:0.85rem;font-weight:700;color:${col};">${pct}%</span>
                  </div>`;
                }).join('')
              : `<div style="text-align:center;padding:2rem;color:var(--muted);">
                  <div style="font-size:2rem;margin-bottom:0.5rem;">🎯</div>
                  <div style="font-size:0.85rem;">No quizzes yet. <a href="/quiz" style="color:var(--accent);">Take a quiz</a></div>
                </div>`
            }
          </div>
        </div>
      </div>
    </section>
  </div>`, 'dashboard', true, name);
}

// ─── PAGE: 404 ────────────────────────────────────────────────────────────────
function notFoundPage(loggedIn, username) {
  return shell('404', `
  <div class="page" style="display:flex;align-items:center;justify-content:center;text-align:center;padding:6rem 1.5rem;">
    <div>
      <div style="font-family:'Instrument Serif',serif;font-size:8rem;color:var(--border);line-height:1;margin-bottom:1rem;">404</div>
      <div style="font-family:'Instrument Serif',serif;font-size:2rem;margin-bottom:1rem;">Page not found</div>
      <p style="color:var(--muted);margin-bottom:2rem;">The page you're looking for doesn't exist.</p>
      <a href="/" class="btn btn-primary">Go Home →</a>
    </div>
  </div>`, '', loggedIn, username);
}

// ─── SERVER ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method   = req.method;
  const session  = await getSession(req);
  const loggedIn = !!session;
  const username = session?.name || '';

  const send = (code, html) => { res.writeHead(code, {'Content-Type':'text/html'}); res.end(html); };
  const redirect = (loc) => { res.writeHead(302, {'Location':loc}); res.end(); };

  try {
    // ── GET ──
    if (method === 'GET') {
      if (pathname === '/')          return send(200, homePage(loggedIn, username));
      if (pathname === '/quiz')      return send(200, quizPage(loggedIn, username));
      if (pathname === '/resources') return send(200, resourcesPage(loggedIn, username));
      if (pathname === '/register')  return send(200, registerPage());
      if (pathname === '/login')     return send(200, loginPage());

      if (pathname === '/courses') {
        let enrolledIds = [];
        if (loggedIn) {
          const r = await db.query('SELECT course_id FROM enrollments WHERE user_id=$1', [session.id]);
          enrolledIds = r.rows.map(x => x.course_id);
        }
        return send(200, coursesPage(loggedIn, username, enrolledIds));
      }

      if (pathname.startsWith('/lessons/')) {
        if (!loggedIn) return send(200, lessonLockPage(false, ''));
        const courseId = pathname.replace('/lessons/','');
        const course   = COURSES.find(c => c.id === courseId);
        if (!course) return send(404, notFoundPage(loggedIn, username));
        const enrolled = await db.query('SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2', [session.id, courseId]);
        if (!enrolled.rowCount) return redirect('/courses');
        const lessons  = await db.query('SELECT * FROM lessons WHERE course_id=$1 ORDER BY order_num', [courseId]);
        return send(200, lessonsPage(course, lessons.rows, loggedIn, username));
      }

      if (pathname === '/dashboard') {
        if (!loggedIn) return redirect('/login');
        return send(200, await dashboardPage(session));
      }

      if (pathname === '/logout') {
        await destroySession(req, res);
        return redirect('/');
      }
    }

    // ── POST ──
    if (method === 'POST') {
      const body = await parseBody(req);

      if (pathname === '/register') {
        const { name, email, password } = body;
        if (!name || !email || !password) return send(200, registerPage('All fields are required.'));
        if (password.length < 6)          return send(200, registerPage('Password must be at least 6 characters.'));
        const exists = await db.query('SELECT id FROM users WHERE email=$1', [email]);
        if (exists.rowCount)              return send(200, registerPage('An account with this email already exists.'));
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        const result = await db.query('INSERT INTO users(name,email,password) VALUES($1,$2,$3) RETURNING id', [name, email, hash]);
        await createSession(res, { id: result.rows[0].id, name, email });
        return redirect('/dashboard');
      }

      if (pathname === '/login') {
        const { email, password } = body;
        const result = await db.query('SELECT id,name,password FROM users WHERE email=$1', [email]);
        if (!result.rowCount) return send(200, loginPage('Invalid email or password.'));
        const user  = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return send(200, loginPage('Invalid email or password.'));
        await createSession(res, { id: user.id, name: user.name, email });
        return redirect('/dashboard');
      }

      if (pathname === '/enroll') {
        if (!loggedIn) return redirect('/login');
        const { course_id } = body;
        if (COURSES.find(c => c.id === course_id)) {
          await db.query('INSERT INTO enrollments(user_id,course_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [session.id, course_id]);
        }
        return redirect('/courses');
      }

      if (pathname === '/save-quiz') {
        if (!loggedIn) { res.writeHead(401); return res.end(); }
        let body2 = '';
        req.on('data', c => body2 += c);
        await new Promise(r => req.on('end', r));
        try {
          const { score, total } = JSON.parse(body2);
          await db.query('INSERT INTO quiz_results(user_id,score,total) VALUES($1,$2,$3)', [session.id, score, total]);
        } catch {}
        res.writeHead(200); return res.end('ok');
      }
    }

    send(404, notFoundPage(loggedIn, username));

  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500, {'Content-Type':'text/plain'});
    res.end('Internal Server Error');
  }
});

// ─── START ────────────────────────────────────────────────────────────────────
async function start() {
  console.log('  Connecting to PostgreSQL...');
  await db.query('SELECT 1');
  console.log('  ✅ PostgreSQL connected');
  await initDB();
  console.log('  ✅ Database tables ready');

  server.listen(PORT, '0.0.0.0', () => {
    console.log('=====================================');
    console.log('  LearnHub v3.0 is running!');
    console.log('=====================================');
    console.log('  http://localhost:' + PORT);
    console.log('=====================================');
    console.log('  Stack: Node · PG 16 · Redis · Docker');
    console.log('=====================================');
  });
}

start().catch(err => { console.error('Startup failed:', err); process.exit(1); });
