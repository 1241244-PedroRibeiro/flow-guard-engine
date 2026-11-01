NAME = flowguard
COMPOSE = docker compose -p $(NAME) -f docker-compose.yml
SERVICE ?=

.DEFAULT_GOAL := all
.PHONY: all up build stop down restart logs ps db config clean fclean re help

all: ## Build and start the FlowGuard backend and PostgreSQL database in the foreground
	$(COMPOSE) up --build

up: ## Build and start services in the background (optional: SERVICE=backend)
	$(COMPOSE) up -d --build $(SERVICE)

build: ## Build images without starting containers (optional: SERVICE=backend)
	$(COMPOSE) build $(SERVICE)

stop: ## Stop services while keeping containers and database data
	$(COMPOSE) stop $(SERVICE)

down: ## Remove containers and networks while keeping images and database data
	$(COMPOSE) down

restart: ## Restart existing containers (optional: SERVICE=backend)
	$(COMPOSE) restart $(SERVICE)

logs: ## Follow the last 100 log lines (optional: SERVICE=backend or postgres)
	$(COMPOSE) logs --follow --tail=100 $(SERVICE)

ps: ## Show service status
	$(COMPOSE) ps -a

db: ## Open PostgreSQL interactive prompt (list tables: \dt; list views: \dv; exit: \q)
	$(COMPOSE) exec postgres sh -c 'exec psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

config: ## Validate and display the resolved Compose configuration
	$(COMPOSE) config

clean: ## Remove containers, networks and service images; keep database data
	$(COMPOSE) down --rmi all --remove-orphans

fclean: ## Full reset: also DELETE database volumes and all stored data
	$(COMPOSE) down --volumes --rmi all --remove-orphans

re: ## Delete database data and images, then rebuild and start in the foreground
	$(MAKE) fclean
	$(MAKE) all

help: ## List available commands
	@awk 'BEGIN {FS = ":.*## "; print "Usage: make [target] [NAME=flowguard] [SERVICE=backend|postgres]\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)