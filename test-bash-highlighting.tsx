import React from 'react';
import { Highlight, themes, Language } from 'prism-react-renderer';

// Test different bash code samples
const bashSamples = [
  {
    name: "Simple command with prompt",
    code: "$ echo hello world"
  },
  {
    name: "Command with output",
    code: `$ echo hello world
hello world`
  },
  {
    name: "Multiple commands",
    code: `$ ls -la
total 24
drwxr-xr-x  3 user user 4096 Jan 1 12:00 .
drwxr-xr-x 10 user user 4096 Jan 1 11:00 ..
-rw-r--r--  1 user user  220 Jan 1 10:00 .bashrc
$ pwd
/home/user`
  },
  {
    name: "Command without prompt",
    code: "echo hello world"
  }
];

function TestBashHighlighting() {
  return (
    <div>
      {bashSamples.map((sample, index) => (
        <div key={index} style={{ marginBottom: '2rem' }}>
          <h3>{sample.name}</h3>
          <Highlight
            theme={themes.github}
            code={sample.code}
            language="bash"
          >
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre className={className} style={style}>
                <code>
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line, key: i })}>
                      {line.map((token, key) => {
                        console.log(`Line ${i}, Token ${key}:`, token);
                        return <span key={key} {...getTokenProps({ token, key })} />
                      })}
                    </div>
                  ))}
                </code>
              </pre>
            )}
          </Highlight>
        </div>
      ))}
    </div>
  );
}

export default TestBashHighlighting;