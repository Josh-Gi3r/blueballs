OZ_VERSION := v5.6.1
FORGE_STD_VERSION := v1.16.2

.PHONY: deps fmt build test ci stress clean

deps:
	@if [ ! -d lib/openzeppelin-contracts ]; then \
		mkdir -p lib && \
		git clone --quiet --depth 1 --branch $(OZ_VERSION) \
			https://github.com/OpenZeppelin/openzeppelin-contracts.git \
			lib/openzeppelin-contracts; \
	fi
	@if [ ! -d lib/forge-std ]; then \
		mkdir -p lib && \
		git clone --quiet --depth 1 --branch $(FORGE_STD_VERSION) \
			https://github.com/foundry-rs/forge-std.git \
			lib/forge-std; \
	fi

fmt:
	forge fmt --check

build: deps
	forge build --sizes

test: deps
	forge test -vvv

ci: deps
	forge fmt --check
	forge build --sizes
	FOUNDRY_PROFILE=ci forge test -vv

stress: deps
	FOUNDRY_PROFILE=stress forge test -vv

clean:
	forge clean
