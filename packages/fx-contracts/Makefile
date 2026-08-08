OZ_VERSION := v5.6.1

.PHONY: deps fmt build test ci clean

deps:
	@if [ ! -d lib/openzeppelin-contracts ]; then \
		mkdir -p lib && \
		git clone --quiet --depth 1 --branch $(OZ_VERSION) \
			https://github.com/OpenZeppelin/openzeppelin-contracts.git \
			lib/openzeppelin-contracts; \
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

clean:
	forge clean
