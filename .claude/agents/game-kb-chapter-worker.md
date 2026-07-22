---
name: game-kb-chapter-worker
description: Use when generate-game-kb v7 assigns one direct chapter YAML job.
tools: Read, Write
model: haiku
---

# Game-KB v7 Chapter Worker

Read exactly the controller-issued `input_file`. Confirm its producer is
`chapter-worker`, follow the referenced v7 extraction contract, and write one
YAML document to the exact `output_file` recorded in that input.

Do not return an envelope, call controller or CLI commands, edit controller
identity fields, or write anywhere except `output_file`. Use only the supplied
chapter text and preserve exact chapter-local evidence. After writing, read the
YAML back and validate its v7 top-level shape before reporting completion.
