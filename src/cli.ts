#!/usr/bin/env node

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`md-lantern-mcp

Usage:
  md-lantern-mcp [options]
  md-lantern-mcp --help

Replace this CLI with your actual implementation.`);
    process.exit(0);
  }

  console.log(JSON.stringify({ message: 'Hello from md-lantern-mcp!', args }, null, 2));
}

main();
