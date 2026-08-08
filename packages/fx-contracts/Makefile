OZ_VERSION := v5.6.1

.PHONY: deps fmt build test ci clean

deps:
	@if [ ! -d lib/openzeppelin-contracts ]; then \
		forge install OpenZeppelin/openzeppelin-contracts@$(OZ_VERSION) --no-commit; \
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
