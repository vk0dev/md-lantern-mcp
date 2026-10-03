"""Trial: does a Hermes agent that believes it is on Telegram reach for publish-report?

Builds the agent exactly like `hermes chat --oneshot` (hermes_cli.oneshot._run_agent), but
stamps platform="telegram" so the Telegram platform hint and the config's
agent.platform_hints.telegram.append land in the system prompt. Tools stay the CLI set, and
the prompt tells the agent not to send anything; the final reply is printed, not delivered.

  cd ~/.hermes/hermes-agent && venv/bin/python <this file> "<query>"
"""
import sys

import run_agent
from hermes_cli import oneshot

_orig_init = run_agent.AIAgent.__init__


def _init(self, *args, **kwargs):
    kwargs["platform"] = "telegram"
    _orig_init(self, *args, **kwargs)


run_agent.AIAgent.__init__ = _init
reply, _ = oneshot._run_agent(sys.argv[1])
print("=== FINAL REPLY ===")
print(reply)
print(f"=== {len(reply)} chars ===")
