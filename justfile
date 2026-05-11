set shell := ["bash", "-c"]
set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"]

default:
    @just --list

fmt:
    pnpm exec prettier . --write

fmt-files *files:
    pnpm exec prettier --write {{files}}

fmt-check:
    pnpm exec prettier . --check

lint:
    pnpm -r --if-present run lint

typecheck:
    pnpm -r --if-present run typecheck

check: fmt-check lint typecheck

dev:
    pnpm --filter "@ani-en/app-anien-flow" --filter "@ani-en/server-anien-flow" --parallel run dev

build:
    pnpm --filter "@ani-en/app-anien-flow" run build

docker-up:
    docker compose -f packages/server-anien-flow-infra/docker-compose.yml up -d

docker-down:
    docker compose -f packages/server-anien-flow-infra/docker-compose.yml down

docker-restart:
    docker compose -f packages/server-anien-flow-infra/docker-compose.yml restart

init-garage:
    packages/server-anien-flow-infra/init-garage.sh
