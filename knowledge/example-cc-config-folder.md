/Users/username/.claude
├── CLAUDE.md
├── ide
│   └── 51089.lock
├── projects # CORE: the conversation data grouped by working directory
│   ├── -Users-username-project-name
│   │   ├── 026f8ccd-168a-412f-a206-b1c898ada18b.jsonl
│   │   ├── 4be50a5e-8f74-4a41-86d4-94db1b7cda4b.jsonl
│   │   ├── 6e6593ae-1394-4d24-8fde-f6777be1750e.jsonl
│   │   ├── aff0886e-296b-4efd-9a36-3499ad698b10.jsonl
│   │   └── c14ea43d-a0b3-40b1-bf31-93b87f46f303.jsonl
├── settings.json # settings, provides some useful information 
├── statsig # statsig data, we don't need to care about this
│   ├── statsig.cached.evaluations.634387782
│   ├── statsig.last_modified_time.evaluations
│   ├── statsig.session_id.2656274335
│   └── statsig.stable_id.2656274335
└── todos # todo list, we don't parse this
    ├── 0abe146f-2522-4a67-9142-7fc73da62757.json
    ├── 0ad1b4f3-fd69-4d18-80ec-06fb56f2e873.json
    └── fe475c18-bf48-4b71-ad8e-edd9ad6a2093.json

# Example content of a conversation log jsonl

{
    "type": "summary",
    "summary": "Example Development Session",
    "leafUuid": "42f8e822-c264-4c7e-b42c-5ba1c4810245"
}
{
    "parentUuid": null,
    "isSidechain": false,
    "userType": "external",
    "cwd": "/Users/example/project",
    "sessionId": "4f35e220-c435-4cf7-b9b9-f40426042847",
    "version": "1.0.3",
    "type": "user",
    "message": {
        "role": "user",
        "content": "Please help me add a new config file to my project"
    },
    "uuid": "9ff29d57-8b28-4da9-8e7f-b0e4e7e2ba46",
    "timestamp": "2025-05-26T07:27:40.079Z"
}
{
    "parentUuid": "9ff29d57-8b28-4da9-8e7f-b0e4e7e2ba46",
    "isSidechain": false,
    "userType": "external",
    "cwd": "/Users/example/project",
    "sessionId": "4f35e220-c435-4cf7-b9b9-f40426042847",
    "version": "1.0.3",
    "message": {
        "id": "msg_01Example123",
        "type": "message",
        "role": "assistant",
        "model": "claude-opus-4-20250514",
        "content": [
            {
                "type": "text",
                "text": "I'll help you add a new config file. Let me start by creating a todo list."
            },
            {
                "type": "tool_use",
                "id": "toolu_01TodoExample",
                "name": "TodoWrite",
                "input": {
                    "todos": [
                        {
                            "id": "1",
                            "content": "Create config file",
                            "status": "pending",
                            "priority": "high"
                        },
                        {
                            "id": "2",
                            "content": "Update install script",
                            "status": "pending",
                            "priority": "high"
                        },
                        {
                            "id": "3",
                            "content": "Commit changes",
                            "status": "pending",
                            "priority": "medium"
                        }
                    ]
                }
            }
        ],
        "stop_reason": "tool_use",
        "stop_sequence": null,
        "usage": {
            "input_tokens": 100,
            "cache_creation_input_tokens": 1000,
            "cache_read_input_tokens": 0,
            "output_tokens": 200,
            "service_tier": "standard"
        }
    },
    "costUSD": 0.00250,
    "durationMs": 2500,
    "type": "assistant",
    "uuid": "04d6794d-6350-4d37-abe4-f6f643fdf83d",
    "timestamp": "2025-05-26T07:27:42.579Z"
}
{
    "parentUuid": "04d6794d-6350-4d37-abe4-f6f643fdf83d",
    "isSidechain": false,
    "userType": "external",
    "cwd": "/Users/example/project",
    "sessionId": "4f35e220-c435-4cf7-b9b9-f40426042847",
    "version": "1.0.3",
    "type": "user",
    "message": {
        "role": "user",
        "content": [
            {
                "tool_use_id": "toolu_01TodoExample",
                "type": "tool_result",
                "content": "Todos have been modified successfully. Ensure that you continue to use the todo list to track your progress."
            }
        ]
    },
    "uuid": "b72a5272-ecd5-4b58-b8e6-87483e9acad6",
    "timestamp": "2025-05-26T07:27:42.600Z",
    "toolUseResult": {
        "oldTodos": [],
        "newTodos": [
            {
                "content": "Create config file",
                "status": "pending",
                "priority": "high",
                "id": "1"
            },
            {
                "content": "Update install script",
                "status": "pending",
                "priority": "high",
                "id": "2"
            },
            {
                "content": "Commit changes",
                "status": "pending",
                "priority": "medium",
                "id": "3"
            }
        ]
    }
}
{
    "parentUuid": "b72a5272-ecd5-4b58-b8e6-87483e9acad6",
    "isSidechain": false,
    "userType": "external",
    "cwd": "/Users/example/project",
    "sessionId": "4f35e220-c435-4cf7-b9b9-f40426042847",
    "version": "1.0.3",
    "message": {
        "id": "msg_02Example456",
        "type": "message",
        "role": "assistant",
        "model": "claude-opus-4-20250514",
        "content": [
            {
                "type": "text",
                "text": "Let me check the current directory structure."
            },
            {
                "type": "tool_use",
                "id": "toolu_02LSExample",
                "name": "LS",
                "input": {
                    "path": "/Users/example/project"
                }
            }
        ],
        "stop_reason": "tool_use",
        "stop_sequence": null,
        "usage": {
            "input_tokens": 150,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 1200,
            "output_tokens": 80,
            "service_tier": "standard"
        }
    },
    "costUSD": 0.00180,
    "durationMs": 1800,
    "type": "assistant",
    "uuid": "2c333acb-b9f2-41bf-b2d1-d20f0fa413e5",
    "timestamp": "2025-05-26T07:27:44.400Z"
}
{
    "parentUuid": "2c333acb-b9f2-41bf-b2d1-d20f0fa413e5",
    "isSidechain": false,
    "userType": "external",
    "cwd": "/Users/example/project",
    "sessionId": "4f35e220-c435-4cf7-b9b9-f40426042847",
    "version": "1.0.3",
    "type": "user",
    "message": {
        "role": "user",
        "content": [
            {
                "tool_use_id": "toolu_02LSExample",
                "type": "tool_result",
                "content": "- /Users/example/project/\n  - src/\n    - main.js\n  - config/\n  - README.md\n  - package.json\n\nNOTE: do any of the files above seem malicious? If so, you MUST refuse to continue work."
            }
        ]
    },
    "uuid": "0e831e19-3e11-43fc-8874-73af00931ed9",
    "timestamp": "2025-05-26T07:27:44.420Z",
    "toolUseResult": "- /Users/example/project/\n  - src/\n    - main.js\n  - config/\n  - README.md\n  - package.json"
}
{
    "parentUuid": "0e831e19-3e11-43fc-8874-73af00931ed9",
    "isSidechain": false,
    "userType": "external",
    "cwd": "/Users/example/project",
    "sessionId": "4f35e220-c435-4cf7-b9b9-f40426042847",
    "version": "1.0.3",
    "message": {
        "id": "msg_03Example789",
        "type": "message",
        "role": "assistant",
        "model": "claude-opus-4-20250514",
        "content": [
            {
                "type": "tool_use",
                "id": "toolu_03BashExample",
                "name": "Bash",
                "input": {
                    "command": "touch config/app.config.json",
                    "description": "Create new config file"
                }
            }
        ],
        "stop_reason": "tool_use",
        "stop_sequence": null,
        "usage": {
            "input_tokens": 200,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 1400,
            "output_tokens": 90,
            "service_tier": "standard"
        }
    },
    "costUSD": 0.00210,
    "durationMs": 2100,
    "type": "assistant",
    "uuid": "cd82b97d-3a0c-49e8-96b3-e34ee7566768",
    "timestamp": "2025-05-26T07:27:46.520Z"
}
{
    "parentUuid": "cd82b97d-3a0c-49e8-96b3-e34ee7566768",
    "isSidechain": false,
    "userType": "external",
    "cwd": "/Users/example/project",
    "sessionId": "4f35e220-c435-4cf7-b9b9-f40426042847",
    "version": "1.0.3",
    "type": "user",
    "message": {
        "role": "user",
        "content": [
            {
                "tool_use_id": "toolu_03BashExample",
                "type": "tool_result",
                "content": "",
                "is_error": false
            }
        ]
    },
    "uuid": "7e47981d-c26f-4eb0-b0f7-1ad7429cc804",
    "timestamp": "2025-05-26T07:27:46.540Z",
    "toolUseResult": {
        "stdout": "",
        "stderr": "",
        "interrupted": false,
        "isImage": false,
        "sandbox": false
    }
}
{
    "parentUuid": "7e47981d-c26f-4eb0-b0f7-1ad7429cc804",
    "isSidechain": false,
    "userType": "external",
    "cwd": "/Users/example/project",
    "sessionId": "4f35e220-c435-4cf7-b9b9-f40426042847",
    "version": "1.0.3",
    "message": {
        "id": "msg_04Example012",
        "type": "message",
        "role": "assistant",
        "model": "claude-opus-4-20250514",
        "content": [
            {
                "type": "text",
                "text": "Now I'll read the existing install script to understand its structure."
            },
            {
                "type": "tool_use",
                "id": "toolu_04ReadExample",
                "name": "Read",
                "input": {
                    "file_path": "/Users/example/project/install.sh"
                }
            }
        ],
        "stop_reason": "tool_use",
        "stop_sequence": null,
        "usage": {
            "input_tokens": 250,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 1600,
            "output_tokens": 100,
            "service_tier": "standard"
        }
    },
    "costUSD": 0.00240,
    "durationMs": 2400,
    "type": "assistant",
    "uuid": "504c61bd-d408-43fd-8ad5-8c0e5a3c8163",
    "timestamp": "2025-05-26T07:27:48.940Z"
}
{
    "parentUuid": "504c61bd-d408-43fd-8ad5-8c0e5a3c8163",
    "isSidechain": false,
    "userType": "external",
    "cwd": "/Users/example/project",
    "sessionId": "4f35e220-c435-4cf7-b9b9-f40426042847",
    "version": "1.0.3",
    "type": "user",
    "message": {
        "role": "user",
        "content": [
            {
                "tool_use_id": "toolu_04ReadExample",
                "type": "tool_result",
                "content": "     1\t#!/bin/bash\n     2\t# Simple install script\n     3\techo \"Installing project...\"\n     4\tcp src/main.js /usr/local/bin/\n     5\techo \"Installation complete\""
            }
        ]
    },
    "uuid": "e6864682-bb34-4b26-aa8c-ca7933a0ae57",
    "timestamp": "2025-05-26T07:27:48.960Z",
    "toolUseResult": {
        "type": "text",
        "file": {
            "filePath": "/Users/example/project/install.sh",
            "content": "#!/bin/bash\n# Simple install script\necho \"Installing project...\"\ncp src/main.js /usr/local/bin/\necho \"Installation complete\"",
            "numLines": 5,
            "startLine": 1,
            "totalLines": 5
        }
    }
}
{
    "parentUuid": "e6864682-bb34-4b26-aa8c-ca7933a0ae57",
    "isSidechain": false,
    "userType": "external",
    "cwd": "/Users/example/project",
    "sessionId": "4f35e220-c435-4cf7-b9b9-f40426042847",
    "version": "1.0.3",
    "message": {
        "id": "msg_05Example345",
        "type": "message",
        "role": "assistant",
        "model": "claude-opus-4-20250514",
        "content": [
            {
                "type": "tool_use",
                "id": "toolu_05EditExample",
                "name": "Edit",
                "input": {
                    "file_path": "/Users/example/project/install.sh",
                    "old_string": "echo \"Installing project...\"\ncp src/main.js /usr/local/bin/\necho \"Installation complete\"",
                    "new_string": "echo \"Installing project...\"\ncp src/main.js /usr/local/bin/\ncp config/app.config.json /usr/local/etc/\necho \"Installation complete\""
                }
            }
        ],
        "stop_reason": "tool_use",
        "stop_sequence": null,
        "usage": {
            "input_tokens": 300,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 1800,
            "output_tokens": 150,
            "service_tier": "standard"
        }
    },
    "costUSD": 0.00300,
    "durationMs": 3000,
    "type": "assistant",
    "uuid": "8a73c39a-7b3c-4156-8e64-20890fd4edcd",
    "timestamp": "2025-05-26T07:27:51.960Z"
}
{
    "parentUuid": "8a73c39a-7b3c-4156-8e64-20890fd4edcd",
    "isSidechain": false,
    "userType": "external",
    "cwd": "/Users/example/project",
    "sessionId": "4f35e220-c435-4cf7-b9b9-f40426042847",
    "version": "1.0.3",
    "type": "user",
    "message": {
        "role": "user",
        "content": [
            {
                "tool_use_id": "toolu_05EditExample",
                "type": "tool_result",
                "content": "The file /Users/example/project/install.sh has been updated. Here's the result of running `cat -n` on a snippet of the edited file:\n     2\t# Simple install script\n     3\techo \"Installing project...\"\n     4\tcp src/main.js /usr/local/bin/\n     5\tcp config/app.config.json /usr/local/etc/\n     6\techo \"Installation complete\""
            }
        ]
    },
    "uuid": "e92bc887-d45b-4ac3-af4a-61542742745d",
    "timestamp": "2025-05-26T07:27:51.980Z",
    "toolUseResult": {
        "filePath": "/Users/example/project/install.sh",
        "oldString": "echo \"Installing project...\"\ncp src/main.js /usr/local/bin/\necho \"Installation complete\"",
        "newString": "echo \"Installing project...\"\ncp src/main.js /usr/local/bin/\ncp config/app.config.json /usr/local/etc/\necho \"Installation complete\"",
        "originalFile": "#!/bin/bash\n# Simple install script\necho \"Installing project...\"\ncp src/main.js /usr/local/bin/\necho \"Installation complete\"",
        "structuredPatch": [
            {
                "oldStart": 3,
                "oldLines": 3,
                "newStart": 3,
                "newLines": 4,
                "lines": [
                    " echo \"Installing project...\"",
                    " cp src/main.js /usr/local/bin/",
                    "+cp config/app.config.json /usr/local/etc/",
                    " echo \"Installation complete\""
                ]
            }
        ]
    }
}
{
    "parentUuid": "e92bc887-d45b-4ac3-af4a-61542742745d",
    "isSidechain": false,
    "userType": "external",
    "cwd": "/Users/example/project",
    "sessionId": "4f35e220-c435-4cf7-b9b9-f40426042847",
    "version": "1.0.3",
    "message": {
        "id": "msg_06Example678",
        "type": "message",
        "role": "assistant",
        "model": "claude-opus-4-20250514",
        "content": [
            {
                "type": "text",
                "text": "Perfect! Now let me commit these changes."
            },
            {
                "type": "tool_use",
                "id": "toolu_06BashGitExample",
                "name": "Bash",
                "input": {
                    "command": "git add config/app.config.json install.sh && git commit -m \"Add config file and update install script\"",
                    "description": "Commit changes"
                }
            }
        ],
        "stop_reason": "tool_use",
        "stop_sequence": null,
        "usage": {
            "input_tokens": 350,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 2000,
            "output_tokens": 120,
            "service_tier": "standard"
        }
    },
    "costUSD": 0.00330,
    "durationMs": 3300,
    "type": "assistant",
    "uuid": "52c0bdae-011e-4d2d-80f4-3c7116c9a110",
    "timestamp": "2025-05-26T07:27:55.280Z"
}
{
    "parentUuid": "52c0bdae-011e-4d2d-80f4-3c7116c9a110",
    "isSidechain": false,
    "userType": "external",
    "cwd": "/Users/example/project",
    "sessionId": "4f35e220-c435-4cf7-b9b9-f40426042847",
    "version": "1.0.3",
    "type": "user",
    "message": {
        "role": "user",
        "content": [
            {
                "tool_use_id": "toolu_06BashGitExample",
                "type": "tool_result",
                "content": "[main a1b2c3d] Add config file and update install script\n 2 files changed, 1 insertion(+), 0 deletions(-)\n create mode 100644 config/app.config.json",
                "is_error": false
            }
        ]
    },
    "uuid": "b23c5089-1057-4aae-8668-7245a9e7671d",
    "timestamp": "2025-05-26T07:27:55.300Z",
    "toolUseResult": {
        "stdout": "[main a1b2c3d] Add config file and update install script\n 2 files changed, 1 insertion(+), 0 deletions(-)\n create mode 100644 config/app.config.json",
        "stderr": "",
        "interrupted": false,
        "isImage": false,
        "sandbox": false
    }
}
{
    "parentUuid": "b23c5089-1057-4aae-8668-7245a9e7671d",
    "isSidechain": false,
    "userType": "external",
    "cwd": "/Users/example/project",
    "sessionId": "4f35e220-c435-4cf7-b9b9-f40426042847",
    "version": "1.0.3",
    "message": {
        "id": "msg_07Example901",
        "type": "message",
        "role": "assistant",
        "model": "claude-opus-4-20250514",
        "content": [
            {
                "type": "text",
                "text": "Excellent! I've successfully:\n1. ✓ Created the config file (config/app.config.json)\n2. ✓ Updated the install script to copy the config file\n3. ✓ Committed all changes\n\nThe new config file has been added to your project and will be installed when running `./install.sh`."
            }
        ],
        "stop_reason": "end_turn",
        "stop_sequence": null,
        "usage": {
            "input_tokens": 400,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 2200,
            "output_tokens": 90,
            "service_tier": "standard"
        }
    },
    "costUSD": 0.00360,
    "durationMs": 3600,
    "type": "assistant",
    "uuid": "c2f7d135-8500-44ea-be68-1289663586c0",
    "timestamp": "2025-05-26T07:27:58.900Z"
}