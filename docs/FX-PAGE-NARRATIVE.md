# FX page narrative

## Purpose

The page starts with the product experience and progressively opens the transaction until the reader can see the market, liquidity, fiat edges, settlement and source code underneath it.

The page is not a feature list and not an FX architecture textbook. The reader should understand the infrastructure by watching one exchange open up layer by layer.

## Flow

1. **Exchange**
   - Show the same customer screen for fiat → fiat, stablecoin → stablecoin, fiat → stablecoin and stablecoin → fiat.
   - The first lesson is simply that the same product can support all four.

2. **Behind the quote**
   - Open one customer exchange and show the places that can fill it: customer/business orders, market makers, issuers/banks, treasury and external providers.
   - The customer still sees one quote.

3. **Your market**
   - Show one customer taking FX and another verified customer/business leaving an FX order.
   - Show the private market between them.

4. **Connected firms**
   - Show three participation modes: resting order, available inventory and JIT/RFQ firm quote.
   - Banks, issuers and professional makers can participate without being forced into one liquidity model.

5. **Market + settlement**
   - Keep account identity, order flow, depth, matching, limits and reservations off-chain.
   - Send only the selected authorised token fills to the on-chain settlement kernel.
   - Show multi-maker atomic token settlement.

6. **Fiat connections**
   - Provider/banking rail.
   - The institution's own verified customers.
   - Open P2P / Peer-style external counterparties.
   - Direct issuer mint/redeem.
   - Stablecoin → stablecoin skips the fiat edges.

7. **Treasury**
   - Show existing balances, an exposure ceiling, reservations and a new customer exchange.
   - Treasury fills only within the configured limit; the remainder goes elsewhere.

8. **Deployment**
   - Show real configurations rather than invented maturity percentages:
     - new financial product;
     - growing neobank;
     - institution;
     - crypto-native product.
   - The customer surface remains the same while the stack behind it changes.

9. **Open-source handoff**
   - Show the actual repository packages behind the page: market, liquidity, pricing, policy, fiat, contracts, SDK and simulator.
   - Then expose the reference market, simulator, implementation explorer and package documentation.

## Copy rules

- Plain product language.
- No pitch-deck slogans.
- No manufactured punchlines.
- No architecture terminology before it is useful.
- Keep the innovations. Do not simplify the system because a sentence is difficult to write.
- The graphics carry much of the explanation.
- Technical vocabulary becomes more explicit as the reader moves down the page.
- Reference participants are always labelled as reference; never imply commercial integrations that are not present.
