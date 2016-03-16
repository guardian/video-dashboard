import json
import os
import sys
import yaml


def _get_input_file():
    if len(sys.argv) == 1:
        converter = os.path.split(sys.argv[0])[1].split('.')[0]
        print('No input file. Usage: python -m convert.{} /path/to/file'.format(converter))
    else:
        return sys.argv[1]


def _get_output_file(input_file):
    filename, _ = os.path.splitext(os.path.basename(input_file))
    return filename


def _get_arguments():
    input = _get_input_file()
    output = _get_output_file(input)

    return input, output


def convert():
    input, output = _get_arguments()

    with open(input, 'r') as f:
        input_yaml = yaml.load(f)

    with open('{}.json'.format(output), 'w') as f:
        json.dump(input_yaml, f, indent=2)

if __name__ == '__main__':
    convert()
