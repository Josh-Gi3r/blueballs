OZ_VERSION := v5.6.1
OZ_COMMIT := 5fd1781b1454fd1ef8e722282f86f9293cacf256
FORGE_STD_VERSION := v1.16.2
FORGE_STD_COMMIT := bf647bd6046f2f7da30d0c2bf435e5c76a780c1b

.PHONY: deps fmt build test ci stress abi clean

deps:
	@if [ ! -d lib/openzeppelin-contracts ]; then \
		mkdir -p lib && \
		git clone --quiet --filter=blob:none --no-checkout \
			https://github.com/OpenZeppelin/openzeppelin-contracts.git lib/openzeppelin-contracts && \
		git -C lib/openzeppelin-contracts checkout --quiet --detach $(OZ_COMMIT); \
	fi
	@test "$$(git -C lib/openzeppelin-contracts rev-parse HEAD)" = "$(OZ_COMMIT)" || \
		( echo "openzeppelin-contracts is not pinned to $(OZ_VERSION) ($(OZ_COMMIT))"; exit 1 )
	@if [ ! -d lib/forge-std ]; then \
		mkdir -p lib && \
		git clone --quiet --filter=blob:none --no-checkout \
			https://github.com/foundry-rs/forge-std.git lib/forge-std && \
		git -C lib/forge-std checkout --quiet --detach $(FORGE_STD_COMMIT); \
	fi
	@test "$$(git -C lib/forge-std rev-parse HEAD)" = "$(FORGE_STD_COMMIT)" || \
		( echo "forge-std is not pinned to $(FORGE_STD_VERSION) ($(FORGE_STD_COMMIT))"; exit 1 )

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

abi: deps
	bash script/export-abis.sh

clean:
	forge clean
	rm -rf abi
