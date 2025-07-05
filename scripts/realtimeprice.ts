interface TickerResponse {
  symbol: string;
  price: string;
}

async function getTokenData() {
  const SYMBOL = "SKORAIUSDT"; // Verify exact symbol on MEXC
  const CIRCULATING_SUPPLY = 26000000; // Replace with actual circulating supply

  try {
    // Fetch price from MEXC API
    const response = await fetch(
      `https://api.mexc.com/api/v3/ticker/price?symbol=${SYMBOL}`
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = (await response.json()) as TickerResponse;
    const price = parseFloat(data.price);

    // Calculate market cap
    const marketCap = price * CIRCULATING_SUPPLY;

    // Format results
    console.log("SKORAI Token Data:");
    console.log("------------------");
    console.log(`Current Price: $${price.toFixed(6)}`);
    console.log(
      `Market Cap: $${marketCap.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`
    );
    console.log(
      `\nNote: Circulating supply used: ${CIRCULATING_SUPPLY.toLocaleString()}`
    );
  } catch (error) {
    console.error("Error fetching data:");
    console.error(error instanceof Error ? error.message : error);
  }
}

// Run the script
getTokenData();
